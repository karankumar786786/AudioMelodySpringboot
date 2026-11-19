import {
  formatDuration,
  formatFollowerCount,
  formatSongSubtitle,
  formatStreams,
} from "@/utils/formatUtils";

describe("formatStreams", () => {
  it.each([
    [undefined, "0 plays"],
    [null, "0 plays"],
    [0, "0 plays"],
    [-5, "0 plays"],
    [1, "1 plays"],
    [999, "999 plays"],
    [1000, "1.0k plays"],
    [15_400, "15.4k plays"],
    [1_000_000, "1.0M plays"],
    [2_550_000, "2.5M plays"],
  ])("formats %p as %p", (input, expected) => {
    expect(formatStreams(input as number | null | undefined)).toBe(expected);
  });
});

describe("formatDuration", () => {
  it.each([
    [undefined, "--:--"],
    [null, "--:--"],
    [0, "--:--"],
    [-3, "--:--"],
    [5, "0:05"],
    [59.9, "0:59"],
    [60, "1:00"],
    [185, "3:05"],
    [3600, "60:00"],
  ])("formats %p as %p", (input, expected) => {
    expect(formatDuration(input as number | null | undefined)).toBe(expected);
  });
});

describe("formatSongSubtitle", () => {
  it("joins the present parts with a bullet", () => {
    expect(formatSongSubtitle("Artist", "Album", "Pop")).toBe("Artist • Album • Pop");
  });

  it("skips empty and missing parts", () => {
    expect(formatSongSubtitle("Artist", null, "")).toBe("Artist");
    expect(formatSongSubtitle(undefined, "Album")).toBe("Album");
  });

  it("falls back when nothing is known", () => {
    expect(formatSongSubtitle()).toBe("Unknown Artist");
    expect(formatSongSubtitle(null, null, null)).toBe("Unknown Artist");
  });
});

describe("formatFollowerCount", () => {
  it("handles empty and invalid input", () => {
    expect(formatFollowerCount(undefined)).toBe("0 followers");
    expect(formatFollowerCount(null)).toBe("0 followers");
    expect(formatFollowerCount("")).toBe("0 followers");
    expect(formatFollowerCount("abc")).toBe("0 followers");
    expect(formatFollowerCount(-1)).toBe("0 followers");
    expect(formatFollowerCount(Infinity)).toBe("0 followers");
    expect(formatFollowerCount(null, false, false)).toBe("0");
  });

  it("uses the singular for exactly one", () => {
    expect(formatFollowerCount(1)).toBe("1 follower");
    expect(formatFollowerCount("1")).toBe("1 follower");
  });

  it("only compacts thousands below 10K when asked", () => {
    expect(formatFollowerCount(1420)).toBe(`${(1420).toLocaleString()} followers`);
    expect(formatFollowerCount(1420, true)).toBe("1.4K followers");
    expect(formatFollowerCount(1000, true)).toBe("1K followers");
  });

  it("compacts 10K and millions, dropping a trailing .0", () => {
    expect(formatFollowerCount(15_200)).toBe("15.2K followers");
    expect(formatFollowerCount(20_000)).toBe("20K followers");
    expect(formatFollowerCount(1_200_000)).toBe("1.2M followers");
    expect(formatFollowerCount(3_000_000)).toBe("3M followers");
  });

  it("floors fractional numbers and parses strings", () => {
    expect(formatFollowerCount(42.9)).toBe("42 followers");
    expect(formatFollowerCount("15200")).toBe("15.2K followers");
  });

  it("can omit the label", () => {
    expect(formatFollowerCount(15_200, false, false)).toBe("15.2K");
  });
});
