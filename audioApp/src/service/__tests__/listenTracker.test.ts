import { ListenTracker, mergeRanges } from "../player/listenTracker";

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

/** Plays from `from` to `to` in 500 ms ticks with the wall clock in step. */
function play(tracker: ListenTracker, c: ReturnType<typeof clock>, from: number, to: number) {
  for (let pos = from; pos <= to; pos += 500) {
    tracker.tick(pos, true, false);
    if (pos + 500 <= to) c.advance(500);
  }
}

describe("mergeRanges", () => {
  it("sorts, joins overlaps and near-gaps, drops empty ranges", () => {
    expect(
      mergeRanges([
        [12_000, 20_000],
        [0, 5_000],
        [5_500, 9_000],
        [19_000, 25_000],
        [30_000, 30_000],
      ]),
    ).toEqual([
      [0, 9_000],
      [12_000, 25_000],
    ]);
  });
});

describe("ListenTracker", () => {
  it("records a straight listen as one range with startup time", () => {
    const c = clock();
    const t = new ListenTracker(c.now);
    t.begin({ quality: "320kbps", platform: "ios" });
    c.advance(300);
    t.tick(0, true, true); // still loading
    c.advance(200);
    play(t, c, 0, 30_000);
    const d = t.finish(30_000, false)!;
    expect(d.ranges).toEqual([[0, 30_000]]);
    expect(d.startupMs).toBe(500);
    expect(d.seeks).toEqual([]);
    expect(d.rebufferCount).toBe(0);
    expect(d).toMatchObject({ quality: "320kbps", platform: "ios", exitMs: 30_000, skipped: false });
  });

  it("detects a seek from the play head jumping", () => {
    const c = clock();
    const t = new ListenTracker(c.now);
    t.begin();
    play(t, c, 0, 10_000);
    c.advance(500);
    play(t, c, 60_000, 70_000); // jumped forward 50 s in half a second
    const d = t.finish(70_000, true)!;
    expect(d.seeks).toEqual([[10_000, 60_000]]);
    expect(d.ranges).toEqual([
      [0, 10_000],
      [60_000, 70_000],
    ]);
    expect(d.skipped).toBe(true);
  });

  it("does not mistake a backgrounded app for a seek", () => {
    const c = clock();
    const t = new ListenTracker(c.now);
    t.begin();
    play(t, c, 0, 5_000);
    c.advance(60_000); // no ticks for a minute, audio kept playing
    play(t, c, 65_000, 70_000);
    const d = t.finish(70_000, false)!;
    expect(d.seeks).toEqual([]);
    expect(d.ranges).toEqual([[0, 70_000]]);
  });

  it("pauses close the range and replays add another", () => {
    const c = clock();
    const t = new ListenTracker(c.now);
    t.begin();
    play(t, c, 0, 20_000);
    c.advance(500);
    t.tick(20_000, false, false); // paused
    c.advance(10_000);
    t.seek(20_000, 5_000); // scrubbed back while paused
    play(t, c, 5_000, 15_000);
    const d = t.finish(15_000, false)!;
    expect(d.seeks).toEqual([[20_000, 5_000]]);
    expect(d.ranges).toEqual([[0, 20_000]]); // the replay is inside the first range
  });

  it("counts stalls after playback started", () => {
    const c = clock();
    const t = new ListenTracker(c.now);
    t.begin();
    play(t, c, 0, 5_000);
    c.advance(500);
    t.tick(5_000, true, true);
    c.advance(1_500);
    t.tick(5_000, true, true);
    c.advance(500);
    t.tick(5_000, true, false);
    play(t, c, 5_000, 8_000);
    const d = t.finish(8_000, false)!;
    expect(d.rebufferCount).toBe(1);
    expect(d.rebufferMs).toBe(2_000);
    expect(d.seeks).toEqual([]);
  });

  it("drops startup that waited on the user", () => {
    const c = clock();
    const t = new ListenTracker(c.now);
    t.begin();
    c.advance(5 * 60_000);
    play(t, c, 0, 2_000);
    expect(t.finish(2_000, false)!.startupMs).toBeUndefined();
  });

  it("finish is once per begin", () => {
    const t = new ListenTracker();
    t.begin();
    expect(t.finish(0, false)).not.toBeNull();
    expect(t.finish(0, false)).toBeNull();
  });
});
