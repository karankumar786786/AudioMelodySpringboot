import { combineReducers, configureStore } from "@reduxjs/toolkit";
import queueReducer, { setQueue, setRepeatMode } from "@/store/queueSlice";
import playerReducer from "@/store/playerSlice";
import type { Song } from "@/types";
import { makeSong, makeSongs } from "@/test/fixtures";

jest.mock("@/store/hook", () => ({ store: { dispatch: jest.fn(), getState: jest.fn() } }));
jest.mock("@/utils/queueLogger", () => ({ logQueueSnapshot: jest.fn() }));
jest.mock("@/storage/PlayerStore", () => ({
  PlayerStore: { saveLastQueue: jest.fn(), getLastPlaybackState: jest.fn() },
}));
jest.mock("@/service/audioPlayerService", () => ({
  audioPlayerService: {
    play: jest.fn(() => Promise.resolve()),
    pause: jest.fn(),
    resume: jest.fn(),
    seek: jest.fn(() => Promise.resolve()),
    getCurrentTime: jest.fn(() => 0),
    setLastPlayed: jest.fn(),
    markCurrentTrackReported: jest.fn(),
    syncUpcomingPreload: jest.fn(),
    setOnTrackEnd: jest.fn(),
    setRemoteCommandHandlers: jest.fn(),
    init: jest.fn(() => Promise.resolve()),
    primeRestoredPlayback: jest.fn(() => Promise.resolve()),
  },
}));
jest.mock("@/service/homeService", () => ({
  homeService: { getTrendingSongs: jest.fn(() => Promise.resolve([])) },
}));
jest.mock("@/service/interactionService", () => ({
  interactionService: {
    recordSkip: jest.fn(),
    recordQueueAdd: jest.fn(),
    recordDislike: jest.fn(() => Promise.resolve()),
  },
}));
jest.mock("@/service/similarityService", () => ({
  similarityService: { findSimilarSongs: jest.fn(() => Promise.resolve([])) },
}));
jest.mock("@/service/userProgressService", () => ({
  userProgressService: { getResumeState: jest.fn(() => Promise.resolve(null)) },
}));

// Imported after the mocks so queueActions picks them up.
import {
  dislikeCurrentSong,
  enqueue,
  nextTrack,
  playAll,
  playAllFrom,
  playNext,
  prevTrack,
  refillQueue,
} from "@/store/queueActions";
import { audioPlayerService } from "@/service/audioPlayerService";
import { similarityService } from "@/service/similarityService";
import { homeService } from "@/service/homeService";
import { interactionService } from "@/service/interactionService";

const player = audioPlayerService as jest.Mocked<typeof audioPlayerService>;
const similarity = similarityService as jest.Mocked<typeof similarityService>;
const home = homeService as jest.Mocked<typeof homeService>;
const interactions = interactionService as jest.Mocked<typeof interactionService>;

function makeStore() {
  return configureStore({
    reducer: combineReducers({
      queue: queueReducer,
      player: playerReducer,
      user: (s: { profile: null } = { profile: null }) => s,
      device: (s: { deviceId: string } = { deviceId: "test-device" }) => s,
    }),
    middleware: (gdm) => gdm({ serializableCheck: false, immutableCheck: false }),
  });
}
type TestStore = ReturnType<typeof makeStore>;

// The thunks are typed against the app store; the test store has the slices they read.
const run = (store: TestStore, thunk: unknown) =>
  (store.dispatch as (t: unknown) => Promise<void> | void)(thunk);

function storeWith(songIds: string[], index = 0, repeat?: "none" | "all" | "one") {
  const store = makeStore();
  store.dispatch(setQueue({ queue: makeSongs(...songIds), index }));
  if (repeat) store.dispatch(setRepeatMode(repeat));
  return store;
}
const current = (store: TestStore) => store.getState().queue.queue[store.getState().queue.currentIndex]?.id;
const playedIds = () => player.play.mock.calls.map((c) => (c[0] as Song).id);

beforeEach(() => {
  jest.clearAllMocks();
  player.getCurrentTime.mockReturnValue(0);
  similarity.findSimilarSongs.mockResolvedValue([]);
  home.getTrendingSongs.mockResolvedValue([]);
});

describe("nextTrack", () => {
  it("does nothing on an empty queue", async () => {
    const store = makeStore();
    await run(store, nextTrack());
    expect(player.play).not.toHaveBeenCalled();
    expect(player.pause).not.toHaveBeenCalled();
  });

  it("advances and plays the next song", async () => {
    const store = storeWith(["a", "b", "c", "d", "e", "f"]);
    await run(store, nextTrack());
    expect(current(store)).toBe("b");
    expect(playedIds()).toEqual(["b"]);
    expect(interactions.recordSkip).not.toHaveBeenCalled();
  });

  it("records a skip only for manual skips", async () => {
    const store = storeWith(["a", "b", "c", "d", "e", "f"]);
    await run(store, nextTrack(true));
    expect(interactions.recordSkip).toHaveBeenCalledWith("a");
    expect(player.markCurrentTrackReported).toHaveBeenCalled();
  });

  it("repeat one restarts the song when it ends naturally", async () => {
    const store = storeWith(["a", "b"], 0, "one");
    await run(store, nextTrack());
    expect(player.seek).toHaveBeenCalledWith(0);
    expect(player.resume).toHaveBeenCalled();
    expect(current(store)).toBe("a");
    expect(player.play).not.toHaveBeenCalled();
  });

  it("repeat one still moves on when the user skips", async () => {
    const store = storeWith(["a", "b"], 0, "one");
    await run(store, nextTrack(true));
    expect(current(store)).toBe("b");
  });

  it("repeat all wraps from the last track to the first without refilling", async () => {
    const store = storeWith(["a", "b"], 1, "all");
    await run(store, nextTrack());
    expect(current(store)).toBe("a");
    expect(playedIds()).toEqual(["a"]);
    expect(similarity.findSimilarSongs).not.toHaveBeenCalled();
  });

  it("on the last track with repeat none, refills and plays the new song", async () => {
    similarity.findSimilarSongs.mockResolvedValue([makeSong("z")]);
    const store = storeWith(["a", "b"], 1);
    await run(store, nextTrack());
    expect(current(store)).toBe("z");
    expect(playedIds()).toEqual(["z"]);
  });

  it("on the last track with nothing to refill, pauses and stays put", async () => {
    const store = storeWith(["a", "b"], 1);
    await run(store, nextTrack());
    expect(current(store)).toBe("b");
    expect(player.pause).toHaveBeenCalled();
    expect(player.play).not.toHaveBeenCalled();
  });
});

describe("prevTrack", () => {
  it("restarts the song when more than 3 seconds in", async () => {
    player.getCurrentTime.mockReturnValue(10);
    const store = storeWith(["a", "b"], 1);
    await run(store, prevTrack());
    expect(player.seek).toHaveBeenCalledWith(0);
    expect(current(store)).toBe("b");
  });

  it("goes to the previous song early in the track", async () => {
    player.getCurrentTime.mockReturnValue(1);
    const store = storeWith(["a", "b"], 1);
    await run(store, prevTrack());
    expect(current(store)).toBe("a");
    expect(playedIds()).toEqual(["a"]);
    expect(interactions.recordSkip).toHaveBeenCalledWith("b");
  });

  it("forceSkip goes back even late in the track", async () => {
    player.getCurrentTime.mockReturnValue(100);
    const store = storeWith(["a", "b"], 1);
    await run(store, prevTrack(true));
    expect(current(store)).toBe("a");
  });

  it("at the first song, seeks to the start", async () => {
    const store = storeWith(["a", "b"], 0);
    await run(store, prevTrack());
    expect(player.seek).toHaveBeenCalledWith(0);
    expect(current(store)).toBe("a");
    expect(player.play).not.toHaveBeenCalled();
  });

  it("on an empty queue, only seeks", async () => {
    const store = makeStore();
    await run(store, prevTrack());
    expect(player.seek).toHaveBeenCalledWith(0);
    expect(player.play).not.toHaveBeenCalled();
  });
});

describe("playAll / playAllFrom", () => {
  it("ignores an empty list", async () => {
    const store = makeStore();
    await run(store, playAll([]));
    await run(store, playAllFrom([], 0));
    expect(store.getState().queue.queue).toEqual([]);
    expect(player.play).not.toHaveBeenCalled();
  });

  it("playAll dedupes and starts from the first song", async () => {
    const store = makeStore();
    await run(store, playAll(makeSongs("a", "b", "a", "c", "d", "e")));
    expect(store.getState().queue.queue.map((s) => s.id)).toEqual(["a", "b", "c", "d", "e"]);
    expect(current(store)).toBe("a");
    expect(playedIds()).toEqual(["a"]);
  });

  it("playAllFrom starts at the chosen song after deduping", async () => {
    const store = makeStore();
    await run(store, playAllFrom(makeSongs("a", "a", "b", "c", "d", "e", "f"), 3));
    expect(current(store)).toBe("c");
  });

  it("playAllFrom clamps an out-of-range start index", async () => {
    const store = makeStore();
    await run(store, playAllFrom(makeSongs("a", "b"), 7));
    expect(current(store)).toBe("b");
  });
});

describe("enqueue / playNext", () => {
  it("enqueue appends and records each add", () => {
    const store = storeWith(["a"]);
    run(store, enqueue(makeSongs("b", "c")));
    expect(store.getState().queue.queue.map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(interactions.recordQueueAdd).toHaveBeenCalledTimes(2);
  });

  it("playNext inserts after the current song", () => {
    const store = storeWith(["a", "b"]);
    run(store, playNext(makeSong("x")));
    expect(store.getState().queue.queue.map((s) => s.id)).toEqual(["a", "x", "b"]);
  });
});

describe("refillQueue", () => {
  it("skips when plenty of songs are upcoming", async () => {
    const store = storeWith(["a", "b", "c", "d", "e"]);
    await run(store, refillQueue());
    expect(similarity.findSimilarSongs).not.toHaveBeenCalled();
  });

  it("never pads a repeat-all queue", async () => {
    const store = storeWith(["a"], 0, "all");
    await run(store, refillQueue(true));
    expect(similarity.findSimilarSongs).not.toHaveBeenCalled();
  });

  it("drops songs already queued or disliked", async () => {
    const store = storeWith(["a"]);
    await run(store, dislikeCurrentSong("bad"));
    similarity.findSimilarSongs.mockResolvedValue(makeSongs("a", "bad", "n"));
    await run(store, refillQueue());
    expect(store.getState().queue.queue.map((s) => s.id)).toEqual(["a", "n"]);
    expect(store.getState().queue.isRefilling).toBe(false);
  });

  it("falls back to trending when similarity returns nothing", async () => {
    home.getTrendingSongs.mockResolvedValue(makeSongs("a", "t"));
    const store = storeWith(["a"]);
    await run(store, refillQueue());
    expect(store.getState().queue.queue.map((s) => s.id)).toEqual(["a", "t"]);
  });

  it("shares one in-flight request", async () => {
    let resolve!: (v: Song[]) => void;
    similarity.findSimilarSongs.mockReturnValue(new Promise((r) => (resolve = r)));
    const store = storeWith(["a"]);
    const p1 = run(store, refillQueue());
    const p2 = run(store, refillQueue());
    resolve([makeSong("n")]);
    await Promise.all([p1, p2]);
    expect(similarity.findSimilarSongs).toHaveBeenCalledTimes(1);
    expect(store.getState().queue.queue.map((s) => s.id)).toEqual(["a", "n"]);
  });

  it("survives a failed request and clears the refilling flag", async () => {
    similarity.findSimilarSongs.mockRejectedValue(new Error("offline"));
    jest.spyOn(console, "warn").mockImplementation(() => {});
    const store = storeWith(["a"]);
    await run(store, refillQueue());
    expect(store.getState().queue.queue.map((s) => s.id)).toEqual(["a"]);
    expect(store.getState().queue.isRefilling).toBe(false);
  });
});

describe("dislikeCurrentSong", () => {
  it("toggles the current song and records only the dislike", async () => {
    const store = storeWith(["a"]);
    await run(store, dislikeCurrentSong());
    expect(store.getState().queue.dislikedSongIds).toEqual(["a"]);
    expect(interactions.recordDislike).toHaveBeenCalledWith("a");
    await run(store, dislikeCurrentSong());
    expect(store.getState().queue.dislikedSongIds).toEqual([]);
    expect(interactions.recordDislike).toHaveBeenCalledTimes(1);
  });

  it("does nothing with no song", async () => {
    const store = makeStore();
    await run(store, dislikeCurrentSong());
    expect(store.getState().queue.dislikedSongIds).toEqual([]);
  });
});
