import { cookies } from "next/headers";
import type { Artist, Playlist, Song, User } from "./types";

export const SERVER_API_BASE_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:9090";

export interface ServerSession {
  user: User | null;
  isAuthenticated: boolean;
}

/**
 * Retrieve session credentials and user profile on the Next.js server via request cookies.
 * If the access token is expired, returns unauthenticated — the client-side
 * refreshAccessToken() will handle cookie rotation via Set-Cookie headers.
 */
export async function getServerSession(): Promise<ServerSession> {
  try {
    const cookieStore = await cookies();
    const rawToken = cookieStore.get("system_token")?.value || null;

    let user: User | null = null;

    if (rawToken) {
      try {
        const parts = rawToken.split(".");
        if (parts.length === 3) {
          const payloadJson = Buffer.from(parts[1], "base64").toString("utf-8");
          const claims = JSON.parse(payloadJson);
          const now = Math.floor(Date.now() / 1000);
          const isExpired =
            claims.exp && typeof claims.exp === "number" && now >= claims.exp;

          if (!isExpired) {
            user = {
              id: claims.id || claims.sub || "",
              email: claims.email || "",
              userName: claims.userName || claims.sub || "User",
              role: claims.role || "USER",
              name: claims.userName || "User",
            } as any;
          }
        }
      } catch {
        user = null;
      }
    }

    return {
      user,
      isAuthenticated: Boolean(rawToken && user),
    };
  } catch {
    return {
      user: null,
      isAuthenticated: false,
    };
  }
}

/**
 * Makes an authenticated request from Next.js Server Components to coreEngine.
 * Automatically injects the user's Bearer token from the incoming request cookies.
 */
export async function serverRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Device-Id": "server-rsc",
    ...(options.headers as Record<string, string>),
  };

  if (cookieHeader) {
    headers["Cookie"] = cookieHeader;
  }

  const url = endpoint.startsWith("http")
    ? endpoint
    : `${SERVER_API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      return null;
    }

    if (response.status === 204) {
      return {} as T;
    }

    const text = await response.text();
    if (!text || !text.trim()) {
      return {} as T;
    }

    return JSON.parse(text) as T;
  } catch (error) {
    console.warn(`[ServerClient] Failed to fetch ${url}:`, error);
    return null;
  }
}

/**
 * Strongly typed Server-Side Music API for Next.js Server Components (RSC)
 */
export const serverMusicApi = {
  artists: {
    getById: async (id: string) => {
      const res = await serverRequest<Artist>(`/api/artists/${id}`, {
        next: { revalidate: 30 },
      });
      return res ? { data: res } : null;
    },
    getSongs: async (id: string, page = 1, size = 15, artistName?: string) => {
      const queryParam = artistName
        ? `&artistName=${encodeURIComponent(artistName)}`
        : "";
      const res = await serverRequest<any>(
        `/api/artists/${id}/songs?page=${page - 1}&size=${size}${queryParam}`,
        { next: { revalidate: 30 } },
      );
      return res;
    },
    list: async (page = 1, size = 100) => {
      const res = await serverRequest<any>(
        `/api/artists?page=${page - 1}&size=${size}`,
        { next: { revalidate: 60 } },
      );
      return res;
    },
  },
  albums: {
    getByName: async (name: string) => {
      const res = await serverRequest<Song[]>(
        `/api/songs/album/${encodeURIComponent(name)}`,
        { next: { revalidate: 60 } },
      );
      return Array.isArray(res) ? res : [];
    },
  },
  playlists: {
    list: async (page = 1, size = 30) => {
      const res = await serverRequest<any>(
        `/api/playlists?page=${page - 1}&size=${size}`,
        { next: { revalidate: 60 } },
      );
      return res;
    },
    getById: async (id: string) => {
      const res = await serverRequest<Playlist>(`/api/playlists/${id}`, {
        next: { revalidate: 30 },
      });
      return res ? { data: res } : null;
    },
    getSongs: async (id: string) => {
      const res = await serverRequest<any>(`/api/playlists/${id}/songs`, {
        next: { revalidate: 30 },
      });
      return res;
    },
  },
  songs: {
    getById: async (id: string) => {
      const res = await serverRequest<Song>(`/api/songs/${id}`, {
        next: { revalidate: 60 },
      });
      return res ? { data: res } : null;
    },
    getFeed: async (page = 1, size = 15) => {
      const res = await serverRequest<any>(
        `/api/songs?page=${page - 1}&size=${size}`,
      );
      return res;
    },
  },
  users: {
    getPlaylistById: async (id: string) => {
      const res = await serverRequest<any>(`/api/user/playlists/${id}`);
      return res ? { data: res } : null;
    },
    getPlaylistSongs: async (id: string) => {
      const res = await serverRequest<any>(`/api/user/playlists/${id}/songs`);
      const list = res?.content || (Array.isArray(res) ? res : []);
      return { data: { data: list as Song[] } };
    },
    getSharedPlaylist: async (tokenOrId: string) => {
      const res = await serverRequest<any>(
        `/api/user/playlists/shared/${tokenOrId}`,
      );
      return res ? { data: res } : null;
    },
    getSharedPlaylistSongs: async (tokenOrId: string, page = 1, size = 50) => {
      const res = await serverRequest<any>(
        `/api/user/playlists/shared/${tokenOrId}/songs?page=${page - 1}&size=${size}`,
      );
      const list = res?.content || (Array.isArray(res) ? res : []);
      return { data: { data: list as Song[] } };
    },
    getFavourites: async (page = 1, size = 100) => {
      const res = await serverRequest<any>(
        `/api/interaction/favourites?page=${page - 1}&size=${size}`,
      );
      const list = res?.content || (Array.isArray(res) ? res : []);
      return { data: { data: list as Song[] } };
    },
    getListeningHistory: async (page = 1, size = 20) => {
      const res = await serverRequest<any>(
        `/api/user/history?page=${page - 1}&size=${size}`,
      );
      return res;
    },
  },
};
