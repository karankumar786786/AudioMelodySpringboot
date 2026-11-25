import type { Page, Request, Route } from "@playwright/test";

export const API = "http://api.test";

export type Role = "SUPER_ADMIN" | "ADMIN";

export const ADMIN_USER = {
  id: "admin-1",
  email: "admin@onemelody.test",
  name: "Test Admin",
};

export interface MockSong {
  id: string;
  title: string;
  artistName: string;
  duration: number;
  language: string;
  genre?: string;
  album?: string;
  country?: string;
  imageKey: string;
  songKey?: string;
  status: string;
  isFeatured?: boolean;
  lrclibId?: string;
  totalStreams?: number;
  createdAt?: string;
}

export function makeSongs(): MockSong[] {
  return [
    {
      id: "song-1",
      title: "Midnight Drive",
      artistName: "The Testers",
      duration: 215,
      language: "English",
      genre: "Pop",
      album: "Night Moves",
      country: "India",
      imageKey: "",
      status: "ACTIVE",
      isFeatured: false,
      lrclibId: "0",
      totalStreams: 1200,
      createdAt: "2026-11-01T10:00:00Z",
    },
    {
      id: "song-2",
      title: "Morning Light",
      artistName: "Dawn Chorus",
      duration: 180,
      language: "Hindi",
      genre: "Indie",
      imageKey: "",
      status: "ACTIVE",
      isFeatured: true,
      lrclibId: "0",
      totalStreams: 800,
      createdAt: "2026-10-20T10:00:00Z",
    },
  ];
}

const emptyPage = (page = 0, size = 20) => ({
  content: [],
  page,
  size,
  paginationMetaData: {
    totalCount: 0,
    activeCount: 0,
    blockedCount: 0,
    deletedCount: 0,
  },
});

interface Call {
  method: string;
  path: string;
  body: unknown;
}

/**
 * In-memory stand-in for adminBackend, S3 and ImageKit. Records every call so a test
 * can assert what the app sent.
 */
export class MockApi {
  readonly calls: Call[] = [];
  songs: MockSong[] = makeSongs();
  shorts: Array<Record<string, unknown>> = [
    {
      id: "short-1",
      ownerType: "LISTENER",
      userId: "listener-1",
      adminId: null,
      songId: "song-1",
      songTitle: "Midnight Drive",
      caption: "Night drive vibes",
      status: "READY",
      hlsKey: "shorts/short-1/master.m3u8",
      thumbnailKey: null,
      durationMs: 18000,
      width: 720,
      height: 1280,
      likesCount: 4,
      viewsCount: 40,
      reportsCount: 1,
      failureReason: null,
      hiddenReason: null,
      createdAt: "2026-11-24T10:00:00Z",
      publishedAt: "2026-11-24T10:01:00Z",
    },
  ];
  role: Role = "SUPER_ADMIN";

  constructor(private readonly page: Page) {}

  callsTo(method: string, pathPattern: RegExp | string): Call[] {
    return this.calls.filter(
      (c) =>
        c.method === method &&
        (typeof pathPattern === "string"
          ? c.path === pathPattern
          : pathPattern.test(c.path)),
    );
  }

  async install(): Promise<void> {
    await this.page.route(`${API}/**`, (route, request) =>
      this.handleApi(route, request),
    );
    // Presigned S3 PUTs and ImageKit uploads.
    await this.page.route("http://s3.test/**", (route) =>
      route.fulfill({ status: 200, body: "" }),
    );
    await this.page.route("https://upload.imagekit.io/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: cors(),
        body: JSON.stringify({ filePath: "/songs/images/cover-test.png" }),
      }),
    );
  }

  /** Signs the browser in as `role` without the OTP flow. */
  async signIn(role: Role = "SUPER_ADMIN"): Promise<void> {
    this.role = role;
    const user = { ...ADMIN_USER, role };
    await this.page.addInitScript((u) => {
      window.localStorage.setItem("admin_user", JSON.stringify(u));
    }, user);
  }

  private async handleApi(route: Route, request: Request): Promise<void> {
    const url = new URL(request.url());
    const method = request.method();
    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors() });
      return;
    }
    let body: unknown = null;
    try {
      body = request.postDataJSON();
    } catch {
      body = request.postData();
    }
    this.calls.push({ method, path: url.pathname, body });

    const json = (status: number, data: unknown) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: cors(),
        body: JSON.stringify(data),
      });
    const p = url.pathname;
    const page = Number(url.searchParams.get("page") ?? 0);
    const size = Number(url.searchParams.get("size") ?? 20);

    // --- auth ---
    if (p === "/auth/login" || p === "/auth/register")
      return json(200, { tempToken: "temp-token" });
    if (p === "/auth/verify-otp") return json(200, { message: "ok" });
    if (p === "/auth/logout" || p === "/auth/refresh-token")
      return json(200, {});
    if (p === "/api/user/profile") {
      return json(200, {
        ...ADMIN_USER,
        userName: ADMIN_USER.name,
        role: this.role,
        status: "ACTIVE",
      });
    }

    // --- dashboard ---
    if (p === "/admin/dashboard/stats") {
      return json(200, {
        totalSongs: this.songs.length,
        activeSongs: this.songs.length,
        featuredSongs: this.songs.filter((s) => s.isFeatured).length,
        totalArtists: 0,
        activeArtists: 0,
        totalPlaylists: 0,
        activePlaylists: 0,
        totalUsers: 1,
        activeUsers: 1,
        blockedUsers: 0,
        totalJobs: 0,
        pendingJobs: 0,
        failedJobs: 0,
        processingJobs: 0,
        completedJobs: 0,
        recentSongs: this.songs,
        recentJobs: [],
      });
    }

    // --- songs ---
    if (p === "/admin/song" && method === "GET") {
      let rows = this.songs.filter((s) => s.status === "ACTIVE");
      const search = (url.searchParams.get("search") ?? "").toLowerCase();
      if (search)
        rows = rows.filter((s) => s.title.toLowerCase().includes(search));
      if (url.searchParams.get("featured") === "true")
        rows = rows.filter((s) => s.isFeatured);
      return json(200, {
        content: rows.slice(page * size, page * size + size),
        page,
        size,
        paginationMetaData: {
          totalCount: rows.length,
          activeCount: rows.length,
          blockedCount: 0,
          deletedCount: 0,
        },
      });
    }
    if (p === "/admin/song" && method === "POST")
      return json(201, { jobId: "job-new", status: "PENDING" });
    const featured = p.match(/^\/admin\/song\/([^/]+)\/featured$/);
    if (featured && method === "PATCH") {
      const song = this.songs.find((s) => s.id === featured[1]);
      if (!song) return json(404, { error: "Not found" });
      const b = body as { featured?: boolean };
      song.isFeatured = b?.featured ?? !song.isFeatured;
      return json(200, song);
    }
    const songDetail = p.match(/^\/admin\/song\/([^/]+)$/);
    if (songDetail && method === "DELETE") {
      const song = this.songs.find((s) => s.id === songDetail[1]);
      if (song) song.status = "DELETED";
      return route.fulfill({ status: 204, headers: cors(), body: "" });
    }
    if (songDetail && method === "GET") {
      const song = this.songs.find((s) => s.id === songDetail[1]);
      return song ? json(200, song) : json(404, { error: "Not found" });
    }

    // --- shorts ---
    if (p === "/admin/shorts" && method === "GET") {
      const status = url.searchParams.get("status");
      const rows = this.shorts.filter((x) => !status || x.status === status);
      return json(200, {
        content: rows.slice(page * size, page * size + size),
        page,
        size,
        paginationMetaData: {
          totalCount: rows.length,
          activeCount: rows.length,
          blockedCount: 0,
          deletedCount: 0,
        },
      });
    }
    if (p === "/admin/shorts/reports") return json(200, emptyPage(page, size));
    const shortAction = p.match(/^\/admin\/shorts\/([^/]+)\/(hide|unhide)$/);
    if (shortAction && method === "POST") {
      const short = this.shorts.find((x) => x.id === shortAction[1]);
      if (!short) return json(404, { message: "Short not found" });
      short.status = shortAction[2] === "hide" ? "HIDDEN" : "READY";
      return json(200, short);
    }

    // --- uploads ---
    if (
      p === "/webhook/internal/song-upload-url" ||
      p === "/webhook/internal/video-upload-url"
    ) {
      return json(200, {
        preSignedUrl: "http://s3.test/upload/temp-audio",
        key: "temp/audio-test",
      });
    }
    if (p === "/webhook/internal/image-upload-param") {
      return json(200, {
        key: "cover-test",
        param: { signature: "sig", expire: 9999999999, token: "tok" },
      });
    }

    // --- everything else the screens touch: empty lists and summaries ---
    if (/^\/admin\/(artist|playlist|account|jobs|delete-jobs)$/.test(p))
      return json(200, emptyPage(page, size));
    if (p.endsWith("/summary")) {
      return json(200, {
        totalJobs: 0,
        currentlyProcessing: 0,
        pendingQueued: 0,
        completed: 0,
        failed: 0,
        stageBreakdown: {},
      });
    }
    if (p.endsWith("/active")) return json(200, []);
    if (p === "/admin/jobs/queues")
      return json(200, {
        totalQueued: 0,
        overallStatus: "HEALTHY",
        queues: [],
      });
    if (p === "/admin/system/health")
      return json(200, {
        timestamp: new Date().toISOString(),
        adminBackend: { status: "UP" },
      });

    return json(404, { error: `No mock for ${method} ${p}` });
  }
}

function cors(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": `http://localhost:${process.env.E2E_PORT ?? 3100}`,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,X-Admin-Client,X-TEMP-TOKEN",
  };
}
