import reducer, {
  addToQueue,
  advanceToNextTrack,
  clearQueue,
  clearUpcomingQueue,
  dislikeSong,
  playNextTrack,
  removeFromQueue,
  removeSongFromQueue,
  reorderQueue,
  retreatToPrevTrack,
  selectCurrentSongFromQueue,
  selectUpcomingSongs,
  setQueue,
  setRepeatMode,
  toggleDislikeSong,
  toggleRepeat,
  toggleShuffle,
} from "@/store/queueSlice";
import type { QueueState } from "@/types";
import { makeSong, makeSongs } from "@/test/fixtures";

const empty = (): QueueState => reducer(undefined, { type: "@@init" });
const ids = (s: QueueState) => s.queue.map((x) => x.id);
const withQueue = (songIds: string[], index = 0, extra: Partial<QueueState> = {}): QueueState => ({
  ...reducer(empty(), setQueue({ queue: makeSongs(...songIds), index })),
  ...extra,
});

describe("initial state", () => {
  it("starts empty with no current song", () => {
    const s = empty();
    expect(s.queue).toEqual([]);
    expect(s.currentIndex).toBe(-1);
    expect(s.repeatMode).toBe("none");
    expect(s.isShuffle).toBe(false);
    expect(selectCurrentSongFromQueue(s)).toBeNull();
    expect(selectUpcomingSongs(s)).toEqual([]);
  });
});

describe("setQueue", () => {
  it("defaults to the first song", () => {
    const s = reducer(empty(), setQueue({ queue: makeSongs("a", "b") }));
    expect(s.currentIndex).toBe(0);
  });

  it("clamps the index into range", () => {
    expect(reducer(empty(), setQueue({ queue: makeSongs("a", "b"), index: 9 })).currentIndex).toBe(1);
    expect(reducer(empty(), setQueue({ queue: makeSongs("a", "b"), index: -4 })).currentIndex).toBe(0);
  });

  it("uses -1 for an empty queue", () => {
    expect(reducer(withQueue(["a"]), setQueue({ queue: [], index: 3 })).currentIndex).toBe(-1);
  });
});

describe("add and remove", () => {
  it("appends one or many songs without moving the index", () => {
    let s = withQueue(["a"]);
    s = reducer(s, addToQueue(makeSong("b")));
    s = reducer(s, addToQueue(makeSongs("c", "d")));
    expect(ids(s)).toEqual(["a", "b", "c", "d"]);
    expect(s.currentIndex).toBe(0);
  });

  it("playNextTrack inserts right after the current song", () => {
    const s = reducer(withQueue(["a", "b", "c"], 1), playNextTrack(makeSong("x")));
    expect(ids(s)).toEqual(["a", "b", "x", "c"]);
    expect(s.currentIndex).toBe(1);
  });

  it("playNextTrack on an empty queue makes the song current", () => {
    const s = reducer(empty(), playNextTrack(makeSong("x")));
    expect(ids(s)).toEqual(["x"]);
    expect(s.currentIndex).toBe(0);
  });

  it("removing a song before the current one shifts the index back", () => {
    const s = reducer(withQueue(["a", "b", "c"], 2), removeFromQueue(0));
    expect(ids(s)).toEqual(["b", "c"]);
    expect(selectCurrentSongFromQueue(s)?.id).toBe("c");
  });

  it("removing a song after the current one keeps the index", () => {
    const s = reducer(withQueue(["a", "b", "c"], 1), removeFromQueue(2));
    expect(s.currentIndex).toBe(1);
  });

  it("removing the current song lets the next slide in", () => {
    const s = reducer(withQueue(["a", "b", "c"], 1), removeFromQueue(1));
    expect(selectCurrentSongFromQueue(s)?.id).toBe("c");
  });

  it("removing the current last song moves to the new last song", () => {
    const s = reducer(withQueue(["a", "b", "c"], 2), removeFromQueue(2));
    expect(s.currentIndex).toBe(1);
    expect(selectCurrentSongFromQueue(s)?.id).toBe("b");
  });

  it("removing the only song empties the queue", () => {
    const s = reducer(withQueue(["a"]), removeFromQueue(0));
    expect(s.queue).toEqual([]);
    expect(s.currentIndex).toBe(-1);
  });

  it("ignores out-of-range removals", () => {
    const before = withQueue(["a", "b"]);
    expect(reducer(before, removeFromQueue(-1))).toEqual(before);
    expect(reducer(before, removeFromQueue(2))).toEqual(before);
    expect(reducer(empty(), removeFromQueue(0))).toEqual(empty());
  });

  it("removeSongFromQueue only removes an upcoming copy", () => {
    let s = withQueue(["a", "b", "a", "c"], 1);
    s = reducer(s, removeSongFromQueue("a"));
    expect(ids(s)).toEqual(["a", "b", "c"]);
    // The current song itself is never removed this way.
    s = reducer(s, removeSongFromQueue("b"));
    expect(ids(s)).toEqual(["a", "b", "c"]);
  });

  it("clearQueue and clearUpcomingQueue", () => {
    expect(reducer(withQueue(["a", "b"]), clearQueue())).toMatchObject({ queue: [], currentIndex: -1 });
    expect(ids(reducer(withQueue(["a", "b", "c"], 1), clearUpcomingQueue()))).toEqual(["a", "b"]);
    expect(reducer(empty(), clearUpcomingQueue()).queue).toEqual([]);
  });
});

describe("next / previous", () => {
  it("advances through the queue", () => {
    expect(reducer(withQueue(["a", "b"]), advanceToNextTrack()).currentIndex).toBe(1);
  });

  it("stays on the last track with repeat none or one", () => {
    expect(reducer(withQueue(["a", "b"], 1), advanceToNextTrack()).currentIndex).toBe(1);
    expect(reducer(withQueue(["a", "b"], 1, { repeatMode: "one" }), advanceToNextTrack()).currentIndex).toBe(1);
  });

  it("wraps from the last track to the first with repeat all", () => {
    expect(reducer(withQueue(["a", "b"], 1, { repeatMode: "all" }), advanceToNextTrack()).currentIndex).toBe(0);
  });

  it("goes back but never below zero", () => {
    expect(reducer(withQueue(["a", "b"], 1), retreatToPrevTrack()).currentIndex).toBe(0);
    expect(reducer(withQueue(["a", "b"], 0), retreatToPrevTrack()).currentIndex).toBe(0);
  });

  it("does nothing on an empty queue", () => {
    expect(reducer(empty(), advanceToNextTrack())).toEqual(empty());
    expect(reducer(empty(), retreatToPrevTrack())).toEqual(empty());
  });
});

describe("repeat", () => {
  it("cycles none -> all -> one -> none", () => {
    let s = empty();
    s = reducer(s, toggleRepeat());
    expect(s.repeatMode).toBe("all");
    s = reducer(s, toggleRepeat());
    expect(s.repeatMode).toBe("one");
    s = reducer(s, toggleRepeat());
    expect(s.repeatMode).toBe("none");
  });

  it("can be set directly", () => {
    expect(reducer(empty(), setRepeatMode("one")).repeatMode).toBe("one");
  });
});

describe("shuffle", () => {
  afterEach(() => jest.restoreAllMocks());

  it("shuffles only the songs after the current one", () => {
    jest.spyOn(Math, "random").mockReturnValue(0);
    const s = reducer(withQueue(["a", "b", "c", "d", "e"], 1), toggleShuffle());
    expect(s.isShuffle).toBe(true);
    expect(s.currentIndex).toBe(1);
    expect(ids(s).slice(0, 2)).toEqual(["a", "b"]);
    expect(ids(s).slice(2)).toEqual(["d", "e", "c"]);
    expect([...ids(s)].sort()).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("keeps the order when turned off", () => {
    jest.spyOn(Math, "random").mockReturnValue(0);
    const on = reducer(withQueue(["a", "b", "c", "d"]), toggleShuffle());
    const off = reducer(on, toggleShuffle());
    expect(off.isShuffle).toBe(false);
    expect(ids(off)).toEqual(ids(on));
  });

  it("is a no-op on the order for an empty queue or the last track", () => {
    const e = reducer(empty(), toggleShuffle());
    expect(e.isShuffle).toBe(true);
    expect(e.queue).toEqual([]);
    const last = reducer(withQueue(["a", "b", "c"], 2), toggleShuffle());
    expect(ids(last)).toEqual(["a", "b", "c"]);
  });

  it("always leaves shuffleOrder null", () => {
    expect(reducer(withQueue(["a", "b", "c"]), toggleShuffle()).shuffleOrder).toBeNull();
  });
});

describe("reorderQueue", () => {
  it("moves the current song and follows it", () => {
    const s = reducer(withQueue(["a", "b", "c"], 0), reorderQueue({ fromIndex: 0, toIndex: 2 }));
    expect(ids(s)).toEqual(["b", "c", "a"]);
    expect(s.currentIndex).toBe(2);
  });

  it("adjusts the index when a song crosses the current one", () => {
    const fwd = reducer(withQueue(["a", "b", "c", "d"], 2), reorderQueue({ fromIndex: 0, toIndex: 3 }));
    expect(selectCurrentSongFromQueue(fwd)?.id).toBe("c");
    const back = reducer(withQueue(["a", "b", "c", "d"], 1), reorderQueue({ fromIndex: 3, toIndex: 0 }));
    expect(selectCurrentSongFromQueue(back)?.id).toBe("b");
  });

  it("ignores invalid moves", () => {
    const before = withQueue(["a", "b"]);
    expect(reducer(before, reorderQueue({ fromIndex: 0, toIndex: 0 }))).toEqual(before);
    expect(reducer(before, reorderQueue({ fromIndex: 0, toIndex: 5 }))).toEqual(before);
    expect(reducer(before, reorderQueue({ fromIndex: -1, toIndex: 1 }))).toEqual(before);
  });
});

describe("dislikes", () => {
  it("dislikeSong adds once", () => {
    let s = reducer(empty(), dislikeSong("a"));
    s = reducer(s, dislikeSong("a"));
    expect(s.dislikedSongIds).toEqual(["a"]);
  });

  it("toggleDislikeSong adds and removes", () => {
    let s = reducer(empty(), toggleDislikeSong("a"));
    expect(s.dislikedSongIds).toEqual(["a"]);
    s = reducer(s, toggleDislikeSong("a"));
    expect(s.dislikedSongIds).toEqual([]);
  });
});

describe("selectors", () => {
  it("selectUpcomingSongs returns up to count songs after the current one", () => {
    const s = withQueue(["a", "b", "c", "d"], 1);
    expect(selectUpcomingSongs(s).map((x) => x.id)).toEqual(["c", "d"]);
    expect(selectUpcomingSongs(s, 1).map((x) => x.id)).toEqual(["c"]);
    expect(selectUpcomingSongs(withQueue(["a"]), 5)).toEqual([]);
  });
});
