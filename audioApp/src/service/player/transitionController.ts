import { store } from "@/store/hook";
import { AudioPlayerPool, PlayerSlot } from "../audioPlayerPool";
import {
  canTransition,
  crossfadeVolumes,
  decideTransitionStart,
  effectiveCrossfadeDuration,
  fadeElapsed,
  GAPLESS_LEAD_SECONDS,
  hasPassedFadeMidpoint,
  isFadeComplete,
  isInTransitionWindow,
  shouldEnsurePreload,
} from "./transitionMath";

const TICK_MS = 50;
/** After a skip cancels a transition, don't start another one for this long. */
const CANCEL_HOLD_OFF_MS = 1500;
/** If the queue never hands over (play() failed), roll back after this long. */
const HANDOVER_TIMEOUT_MS = 6000;
/** Treat the outgoing track as finished this close to its end. */
const END_EPSILON_SECONDS = 0.05;

export type TransitionCancelReason = "skip" | "seek" | "stop" | "conditions-changed" | "timeout";

interface TransitionDeps {
  pool: AudioPlayerPool;
  isSeeking: () => boolean;
  isAdvancing: () => boolean;
  isExplicitlyPaused: () => boolean;
  /** Advance the queue to the incoming song; it will come back as play(incoming). */
  onHandoverDue: (incomingSongId: string) => void;
  /** The transition ended (finished or cancelled): re-sync the standby preloads. */
  onSettled: () => void;
  /** The next track isn't buffered yet and the end is near: preload it now. */
  ensurePreload: () => void;
}

interface RunningTransition {
  kind: "gapless" | "crossfade";
  outgoing: PlayerSlot;
  incoming: PlayerSlot;
  outgoingSongId: string;
  incomingSongId: string;
  trackDuration: number;
  fadeDuration: number;
  handoverRequested: boolean;
  handoverRequestedAt: number;
  handedOver: boolean;
  paused: boolean;
  volumes: { outgoing: number; incoming: number };
}

/**
 * Drives track transitions using the pool's preloaded standby 1:
 *
 * - Gapless (crossfade 0): GAPLESS_LEAD_SECONDS before the end, the next player starts
 *   at full volume and the queue advances; the outgoing player keeps playing to its
 *   real end, so neither a gap nor a cut-off tail is heard.
 * - Crossfade (1–12s): the next player starts silent at `duration - fade`; volumes
 *   follow an equal-power curve driven by the outgoing play head (so pause freezes
 *   it). At the midpoint the queue advances, which makes the incoming track current
 *   in Redux and on the lock screen. When the fade completes the outgoing stops.
 *
 * Skip, seek and stop cancel: before the midpoint the incoming is rewound and the
 * outgoing restored; after it the outgoing is just stopped.
 */
export class TransitionController {
  private t: RunningTransition | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private holdOffUntil = 0;
  private preloadEnsuredKey: string | null = null;

  constructor(private deps: TransitionDeps) {}

  public get isRunning(): boolean {
    return this.t !== null;
  }

  /** True when the queue has been asked to advance and play() hasn't arrived yet. */
  public get isHandoverPending(): boolean {
    return Boolean(this.t?.handoverRequested && !this.t.handedOver);
  }

  /**
   * Whether play(songId) is the handover this controller asked for. A user skip to the
   * same song before the midpoint is not: it cancels the fade and starts the track fresh.
   */
  public isHandoverFor(songId: string): boolean {
    return Boolean(
      this.t && this.t.handoverRequested && !this.t.handedOver && this.t.incomingSongId === songId
    );
  }

  /** The incoming slot's role to promote, plus the volume it should keep. */
  public handoverTarget(): { role: "standby1" | "standby2"; volume: number } | null {
    const t = this.t;
    if (!t || t.incoming.role === "active") return null;
    return {
      role: t.incoming.role,
      volume: t.kind === "crossfade" ? t.volumes.incoming : 1,
    };
  }

  public markHandedOver(): void {
    if (this.t) this.t.handedOver = true;
  }

  /**
   * Volume the active player should have right now (used by resume, which would
   * otherwise snap it to 1 mid-fade). Null when no fade is running.
   */
  public activeVolume(): number | null {
    const t = this.t;
    if (!t || t.kind !== "crossfade") return null;
    return t.handedOver ? t.volumes.incoming : t.volumes.outgoing;
  }

  /** Called on every active-player status update (~250ms). */
  public onStatus(): void {
    if (this.t) {
      this.ensureTicker();
      return;
    }
    const ctx = this.readContext();
    if (!ctx) {
      this.stopTicker();
      return;
    }
    if (
      shouldEnsurePreload({
        position: ctx.position,
        trackDuration: ctx.trackDuration,
        fadeDuration: ctx.fadeDuration,
        hasNextInQueue: true,
        nextReady: ctx.nextReady,
      })
    ) {
      const key = `${ctx.activeSongId}->${ctx.nextSongId}`;
      if (this.preloadEnsuredKey !== key) {
        this.preloadEnsuredKey = key;
        console.log(`[Transition] Next track not ready near end; preloading now (${key})`);
        this.deps.ensurePreload();
      }
    }
    if (isInTransitionWindow(ctx.position, ctx.trackDuration, ctx.fadeDuration)) {
      this.ensureTicker();
    } else {
      this.stopTicker();
    }
  }

  public pause(): void {
    const t = this.t;
    if (!t) return;
    t.paused = true;
    for (const slot of [t.outgoing, t.incoming]) {
      if (slot.isTransitioning) slot.player.pause();
    }
  }

  public resume(): void {
    const t = this.t;
    if (!t) return;
    t.paused = false;
    for (const slot of [t.outgoing, t.incoming]) {
      if (slot.isTransitioning) slot.player.play();
    }
  }

  /** Cancels a running transition (see class doc for what that means per phase). */
  public async cancel(reason: TransitionCancelReason): Promise<void> {
    const t = this.t;
    if (!t) return;
    this.t = null;
    if (reason === "skip" || reason === "timeout") {
      this.holdOffUntil = Date.now() + CANCEL_HOLD_OFF_MS;
    }
    console.log(
      `[Transition] Cancel ${t.kind} (${reason}) ${t.handedOver ? "after" : "before"} handover`
    );

    if (!t.handedOver) {
      if (t.outgoing.role === "active") t.outgoing.player.volume = 1;
      t.outgoing.isTransitioning = false;
      if (t.incoming.role !== "active") {
        await this.deps.pool.endTransition(t.incoming, true);
      } else {
        t.incoming.isTransitioning = false;
      }
    } else {
      await this.deps.pool.endTransition(t.outgoing, false);
      t.incoming.isTransitioning = false;
      if (t.incoming.role === "active") t.incoming.player.volume = 1;
    }
    this.deps.onSettled();
  }

  /** Synchronous teardown for stopAndReset (pool.resetAll pauses every player). */
  public reset(): void {
    this.t = null;
    this.preloadEnsuredKey = null;
    this.stopTicker();
  }

  private ensureTicker(): void {
    if (this.ticker) return;
    this.ticker = setInterval(() => this.evaluate(), TICK_MS);
  }

  private stopTicker(): void {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  /** Snapshot of the active track and its queue successor, or null if not applicable. */
  private readContext() {
    const pool = this.deps.pool;
    const active = pool.getActiveSlot();
    const player = active?.player;
    const activeSong = active?.song;
    if (!player || !activeSong) return null;

    const state = store.getState();
    const { queue, currentIndex, repeatMode } = state.queue;
    if (queue[currentIndex]?.id !== activeSong.id) return null;
    const next = queue[currentIndex + 1];
    if (!next) return null;

    const trackDuration = player.duration || activeSong.duration || 0;
    const position = player.currentTime || 0;
    const standby1 = pool.getStandbySlot("standby1");
    const nextReady = standby1.song?.id === next.id && standby1.isReady;
    const nextDuration = (standby1.player.duration || 0) > 0 ? standby1.player.duration : next.duration;
    const fadeDuration = effectiveCrossfadeDuration(
      state.player.crossfadeSeconds ?? 0,
      trackDuration,
      nextDuration
    );

    return {
      active,
      standby1,
      activeSongId: activeSong.id,
      nextSongId: next.id,
      position,
      trackDuration,
      fadeDuration,
      nextReady,
      repeatMode,
      sleepTimer: state.player.sleepTimer,
      isPlaying: Boolean(player.playing),
    };
  }

  private evaluate(): void {
    if (!this.t) {
      this.maybeStart();
      return;
    }
    this.step(this.t);
  }

  private maybeStart(): void {
    if (Date.now() < this.holdOffUntil) return;
    if (this.deps.isSeeking() || this.deps.isAdvancing() || this.deps.isExplicitlyPaused()) return;
    const ctx = this.readContext();
    if (!ctx) {
      this.stopTicker();
      return;
    }
    if (
      !ctx.isPlaying ||
      !isInTransitionWindow(ctx.position, ctx.trackDuration, ctx.fadeDuration)
    ) {
      // Status updates restart the ticker when playback resumes / nears the end again.
      this.stopTicker();
      return;
    }
    if (
      !canTransition({
        repeatMode: ctx.repeatMode,
        sleepTimer: ctx.sleepTimer,
        nextReady: ctx.nextReady,
        isSeeking: this.deps.isSeeking(),
        isPlaying: ctx.isPlaying,
      })
    ) {
      return;
    }

    const decision = decideTransitionStart({
      position: ctx.position,
      trackDuration: ctx.trackDuration,
      fadeDuration: ctx.fadeDuration,
    });
    if (decision.kind === "none") return;

    const incoming = this.deps.pool.startTransitionIn("standby1");
    if (!incoming) return;
    ctx.active.isTransitioning = true;

    const isFade = decision.kind === "crossfade";
    if (!isFade) incoming.player.volume = 1;

    this.t = {
      kind: decision.kind,
      outgoing: ctx.active,
      incoming,
      outgoingSongId: ctx.activeSongId,
      incomingSongId: ctx.nextSongId,
      trackDuration: ctx.trackDuration,
      fadeDuration: isFade ? decision.fadeDuration : 0,
      handoverRequested: false,
      handoverRequestedAt: 0,
      handedOver: false,
      paused: false,
      volumes: isFade ? { outgoing: 1, incoming: 0 } : { outgoing: 1, incoming: 1 },
    };
    console.log(
      `[Transition] Start ${decision.kind}${isFade ? ` ${decision.fadeDuration.toFixed(1)}s` : ""} → "${incoming.song?.title}" at ${ctx.position.toFixed(2)}/${ctx.trackDuration.toFixed(2)}s`
    );
    this.step(this.t);
  }

  private shouldAbortBeforeHandover(t: RunningTransition): boolean {
    const state = store.getState();
    const { queue, currentIndex, repeatMode } = state.queue;
    return (
      repeatMode === "one" ||
      state.player.sleepTimer === -1 ||
      queue[currentIndex + 1]?.id !== t.incomingSongId ||
      t.incoming.song?.id !== t.incomingSongId ||
      t.outgoing.role !== "active"
    );
  }

  private step(t: RunningTransition): void {
    if (t.paused) return;

    if (!t.handoverRequested && this.shouldAbortBeforeHandover(t)) {
      this.cancel("conditions-changed");
      return;
    }
    if (
      t.handoverRequested &&
      !t.handedOver &&
      Date.now() - t.handoverRequestedAt > HANDOVER_TIMEOUT_MS
    ) {
      this.cancel("timeout");
      return;
    }

    const out = t.outgoing.player;
    const position = out.currentTime || 0;

    if (t.kind === "crossfade") {
      const elapsed = Math.max(0, fadeElapsed(position, t.trackDuration, t.fadeDuration));
      t.volumes = crossfadeVolumes(elapsed, t.fadeDuration);
      out.volume = t.volumes.outgoing;
      t.incoming.player.volume = t.volumes.incoming;

      if (!t.handoverRequested && hasPassedFadeMidpoint(elapsed, t.fadeDuration)) {
        this.requestHandover(t);
      }
      const outgoingEnded = position >= t.trackDuration - END_EPSILON_SECONDS || !out.playing;
      if (t.handedOver && (isFadeComplete(elapsed, t.fadeDuration) || outgoingEnded)) {
        this.finish(t);
      }
      return;
    }

    // Gapless: hand over immediately; let the outgoing play out its last moments.
    if (!t.handoverRequested) {
      this.requestHandover(t);
    }
    const outgoingEnded =
      position >= t.trackDuration - END_EPSILON_SECONDS ||
      !out.playing ||
      position > t.trackDuration + GAPLESS_LEAD_SECONDS;
    if (t.handedOver && outgoingEnded) {
      this.finish(t);
    }
  }

  private requestHandover(t: RunningTransition): void {
    t.handoverRequested = true;
    t.handoverRequestedAt = Date.now();
    console.log(`[Transition] Handover → ${t.incomingSongId} (${t.kind})`);
    this.deps.onHandoverDue(t.incomingSongId);
  }

  private finish(t: RunningTransition): void {
    if (this.t !== t) return;
    this.t = null;
    console.log(`[Transition] ${t.kind} complete`);
    if (t.incoming.role === "active") t.incoming.player.volume = 1;
    t.incoming.isTransitioning = false;
    this.deps.pool.endTransition(t.outgoing, false).finally(() => this.deps.onSettled());
  }
}
