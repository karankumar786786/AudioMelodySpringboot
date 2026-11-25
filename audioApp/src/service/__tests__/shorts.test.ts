import { applyLike, patchShortInPages } from "@/hooks/useShortsFeed";
import { createViewTracker, putFile, Short, shortMediaUrl } from "@/service/shortsService";
import { normalizeType, runUpload, UploadState, validatePick } from "@/service/shortUploadMachine";

const short = (over: Partial<Short> = {}): Short => ({
  id: "s1",
  caption: null,
  status: "READY",
  hlsKey: "shorts/s1/master.m3u8",
  thumbnailKey: null,
  durationMs: 10000,
  width: 720,
  height: 1280,
  likesCount: 3,
  viewsCount: 0,
  liked: false,
  mine: false,
  owner: { type: "LISTENER", userId: "u1", userName: "me" },
  song: null,
  failureReason: null,
  publishedAt: null,
  createdAt: null,
  ...over,
});

describe("validatePick", () => {
  it("accepts a short MP4 or MOV", () => {
    expect(validatePick({ uri: "file:///a.mp4", mimeType: "video/mp4", fileSize: 1e6, durationMs: 20000 })).toBeNull();
    expect(validatePick({ uri: "file:///a.MOV", fileSize: 1e6 })).toBeNull();
  });

  it("rejects other types, big files and long videos", () => {
    expect(validatePick({ uri: "file:///a.gif", mimeType: "image/gif" })).toMatch(/MP4 or MOV/);
    expect(validatePick({ uri: "file:///a.mp4", mimeType: "video/mp4", fileSize: 200 * 1024 * 1024 })).toMatch(/100 MB/);
    expect(validatePick({ uri: "file:///a.mp4", mimeType: "video/mp4", durationMs: 61000 })).toMatch(/60 seconds/);
  });

  it("works out the type from the file name when the picker doesn't say", () => {
    expect(normalizeType({ uri: "file:///clip.mov" })).toBe("video/quicktime");
    expect(normalizeType({ uri: "file:///clip.m4v" })).toBe("video/mp4");
  });
});

describe("runUpload", () => {
  const video = { uri: "file:///clip.mp4", mimeType: "video/mp4", fileSize: 5000, durationMs: 9000 };

  it("goes check → upload with progress → finalize → done", async () => {
    const states: UploadState[] = [];
    const deps = {
      startUpload: jest.fn().mockResolvedValue({ shortId: "s1", uploadUrl: "https://s3/put" }),
      putFile: jest.fn(async (_url: string, _file: unknown, onProgress: (f: number) => void) => {
        onProgress(0.5);
        onProgress(1);
      }),
      completeUpload: jest.fn().mockResolvedValue({}),
    };
    const final = await runUpload(video, { caption: "  hi ", songId: "song-1" }, deps, (s) => states.push(s));

    expect(final).toEqual({ step: "done", shortId: "s1" });
    expect(states.map((s) => s.step)).toEqual(["checking", "uploading", "uploading", "uploading", "finalizing", "done"]);
    expect(deps.startUpload).toHaveBeenCalledWith({ contentType: "video/mp4", sizeBytes: 5000, caption: "hi", songId: "song-1" });
    expect(deps.putFile.mock.calls[0][0]).toBe("https://s3/put");
    expect(deps.completeUpload).toHaveBeenCalledWith("s1");
  });

  it("stops before calling the server when the video is invalid", async () => {
    const deps = { startUpload: jest.fn(), putFile: jest.fn(), completeUpload: jest.fn() };
    const final = await runUpload({ ...video, durationMs: 90000 }, {}, deps, () => {});
    expect(final.step).toBe("error");
    expect(deps.startUpload).not.toHaveBeenCalled();
  });

  it("explains quota and ban errors from the server", async () => {
    const quota = Object.assign(new Error("x"), { response: { status: 429 } });
    const banned = Object.assign(new Error("x"), { response: { status: 403 } });
    const deps = (err: Error) => ({ startUpload: jest.fn().mockRejectedValue(err), putFile: jest.fn(), completeUpload: jest.fn() });
    expect(await runUpload(video, {}, deps(quota), () => {})).toEqual({ step: "error", message: expect.stringMatching(/maximum shorts/) });
    expect(await runUpload(video, {}, deps(banned), () => {})).toEqual({ step: "error", message: expect.stringMatching(/can't post/) });
  });
});

describe("likes", () => {
  it("toggles optimistically and never goes below zero", () => {
    expect(applyLike(short(), true)).toMatchObject({ liked: true, likesCount: 4 });
    expect(applyLike(short({ liked: true, likesCount: 0 }), false)).toMatchObject({ liked: false, likesCount: 0 });
    expect(applyLike(short({ liked: true }), true).likesCount).toBe(3);
  });

  it("uses the server's count once it answers", () => {
    expect(applyLike(short(), true, 10).likesCount).toBe(10);
  });

  it("patches the short in every cached page", () => {
    const data = { pageParams: [null], pages: [{ items: [short(), short({ id: "s2" })], nextCursor: null }] };
    const next = patchShortInPages(data, "s2", (s) => ({ ...s, liked: true }));
    expect(next?.pages[0].items.map((s) => s.liked)).toEqual([false, true]);
    expect(patchShortInPages(undefined, "s1", (s) => s)).toBeUndefined();
  });
});

describe("createViewTracker", () => {
  it("ignores glimpses and sends views in batches", async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    const views = createViewTracker(send, 3);
    views.record("a", 400);
    views.record("a", 2500);
    views.record("b", 1200);
    expect(views.size()).toBe(2);
    await views.flush();
    expect(send).toHaveBeenCalledWith([
      { shortId: "a", watchedMs: 2500 },
      { shortId: "b", watchedMs: 1200 },
    ]);
    expect(views.size()).toBe(0);
  });

  it("drops a batch the server rejects instead of retrying forever", async () => {
    const views = createViewTracker(jest.fn().mockRejectedValue(new Error("offline")));
    views.record("a", 2000);
    await views.flush();
    expect(views.size()).toBe(0);
  });
});

describe("putFile", () => {
  function fakeXhr(status: number) {
    const xhr: any = {
      upload: {},
      open: jest.fn(),
      setRequestHeader: jest.fn(),
      abort: jest.fn(() => xhr.onabort?.()),
      send: jest.fn(() => {
        xhr.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
        xhr.status = status;
        xhr.onload?.();
      }),
    };
    return xhr;
  }

  it("PUTs the file with its type and reports progress", async () => {
    const xhr = fakeXhr(200);
    const progress = jest.fn();
    await putFile("https://s3/put", { uri: "file:///a.mp4", type: "video/mp4", name: "a.mp4" }, progress, () => xhr).promise;
    expect(xhr.open).toHaveBeenCalledWith("PUT", "https://s3/put");
    expect(xhr.setRequestHeader).toHaveBeenCalledWith("Content-Type", "video/mp4");
    expect(progress).toHaveBeenCalledWith(0.5);
  });

  it("fails on an error status", async () => {
    await expect(putFile("u", { uri: "f", type: "video/mp4", name: "a" }, undefined, () => fakeXhr(403)).promise).rejects.toThrow("403");
  });
});

describe("shortMediaUrl", () => {
  it("builds S3 URLs from keys and leaves full URLs alone", () => {
    expect(shortMediaUrl("shorts/s1/master.m3u8")).toMatch(/\/shorts\/s1\/master\.m3u8$/);
    expect(shortMediaUrl("https://cdn/x.m3u8")).toBe("https://cdn/x.m3u8");
    expect(shortMediaUrl(null)).toBe("");
  });
});
