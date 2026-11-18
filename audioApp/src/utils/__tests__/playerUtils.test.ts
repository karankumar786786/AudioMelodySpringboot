import {
  applyRollingWindow,
  dedupeBySongId,
  generateQueueId,
  mapToPlayerSong,
  S3_BASE_URL,
  shuffleArray,
} from "@/utils/playerUtils";

describe("shuffleArray", () => {
  afterEach(() => jest.restoreAllMocks());

  it("returns a new array with the same items and leaves the input alone", () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = shuffleArray(input);
    expect(out).not.toBe(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("handles empty and single-item arrays", () => {
    expect(shuffleArray([])).toEqual([]);
    expect(shuffleArray(["a"])).toEqual(["a"]);
  });

  it("is a Fisher-Yates shuffle driven by Math.random", () => {
    // random() -> 0 always picks j = 0, which rotates the array left by one.
    jest.spyOn(Math, "random").mockReturnValue(0);
    expect(shuffleArray([1, 2, 3, 4])).toEqual([2, 3, 4, 1]);
  });
});

describe("dedupeBySongId", () => {
  it("keeps the first occurrence of each id, in order", () => {
    const items = [{ id: "a", n: 1 }, { id: "b", n: 2 }, { id: "a", n: 3 }, { id: "c", n: 4 }];
    expect(dedupeBySongId(items)).toEqual([{ id: "a", n: 1 }, { id: "b", n: 2 }, { id: "c", n: 4 }]);
  });

  it("drops items without an id", () => {
    const items = [{ id: "" }, null as unknown as { id: string }, { id: "x" }];
    expect(dedupeBySongId(items)).toEqual([{ id: "x" }]);
  });

  it("returns an empty array for an empty list", () => {
    expect(dedupeBySongId([])).toEqual([]);
  });
});

describe("applyRollingWindow", () => {
  const q = ["a", "b", "c", "d", "e", "f"];

  it("leaves short histories untouched", () => {
    expect(applyRollingWindow(q, 0)).toEqual({ trimmedQueue: q, adjustedIndex: 0 });
    expect(applyRollingWindow(q, 2)).toEqual({ trimmedQueue: q, adjustedIndex: 2 });
  });

  it("trims history beyond maxHistory and shifts the index", () => {
    expect(applyRollingWindow(q, 4)).toEqual({ trimmedQueue: ["c", "d", "e", "f"], adjustedIndex: 2 });
    expect(applyRollingWindow(q, 5, 0)).toEqual({ trimmedQueue: ["f"], adjustedIndex: 0 });
  });

  it("keeps the current item at the adjusted index", () => {
    const { trimmedQueue, adjustedIndex } = applyRollingWindow(q, 5, 1);
    expect(trimmedQueue[adjustedIndex]).toBe("f");
  });
});

describe("generateQueueId", () => {
  it("uses the prefix and is unique per call", () => {
    const a = generateQueueId("abc");
    const b = generateQueueId("abc");
    expect(a.startsWith("abc-")).toBe(true);
    expect(a).not.toBe(b);
    expect(generateQueueId().startsWith("song-")).toBe(true);
  });
});

describe("mapToPlayerSong", () => {
  it("builds HLS stream URLs from song keys", () => {
    const p = mapToPlayerSong({ id: "1", title: "t", artistName: "a", songKey: "songs/1", fullVideoKey: "videos/1" });
    expect(p.audioStreamUrl).toBe(`${S3_BASE_URL}/songs/1/master.m3u8`);
    expect(p.videoStreamUrl).toBe(`${S3_BASE_URL}/videos/1/master.m3u8`);
  });

  it("falls back to the full video key for audio and accepts snake_case keys", () => {
    const p = mapToPlayerSong({ id: "1", title: "t", artistName: "a", full_video_key: "v/1" });
    expect(p.audioStreamUrl).toBe(`${S3_BASE_URL}/v/1/master.m3u8`);
  });

  it("leaves URLs empty when there are no keys", () => {
    const p = mapToPlayerSong({ id: "1", title: "t", artistName: "a" });
    expect(p.audioStreamUrl).toBe("");
    expect(p.videoStreamUrl).toBeUndefined();
    expect(p.canvasVideoUrl).toBeUndefined();
    expect(p.coverUrl).toBe("");
    expect(p.duration).toBe(0);
  });

  it("keeps an existing queue id and numeric duration", () => {
    const p = mapToPlayerSong({ id: "1", title: "t", artistName: "a", duration: 200 }, "q-1");
    expect(p.queueId).toBe("q-1");
    expect(p.duration).toBe(200);
  });

  it("passes external absolute image URLs through unchanged", () => {
    const url = "https://example.com/cover.jpg";
    const p = mapToPlayerSong({ id: "1", title: "t", artistName: "a", coverUrl: url });
    expect(p.coverUrl).toBe(url);
    expect(p.posterUrl).toBe(url);
  });

  it("maps lrclib_id to lrclibId", () => {
    const p = mapToPlayerSong({ id: "1", title: "t", artistName: "a", lrclib_id: "99" });
    expect(p.lrclibId).toBe("99");
  });
});
