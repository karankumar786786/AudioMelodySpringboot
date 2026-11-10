import { request } from "./client";
import type { Song } from "./types";

export interface UserProgress {
  songId: string;
  currentTime: number;
  duration: number;
  progressPercent: number;
  contextType?: string;
  contextId?: string;
  updatedAt: string;
  song?: Song;
}

export interface UpdateProgressParams {
  songId: string;
  currentTime: number;
  duration?: number;
  contextType?: string;
  contextId?: string;
}

export const progressApi = {
  saveProgress: async (params: UpdateProgressParams): Promise<UserProgress | null> => {
    try {
      const res = await request<UserProgress>("/api/user/progress", {
        method: "POST",
        body: JSON.stringify(params),
      });
      return res;
    } catch {
      return null;
    }
  },

  getResumeState: async (): Promise<UserProgress | null> => {
    try {
      const res = await request<UserProgress>("/api/user/progress/resume");
      return res?.songId ? res : null;
    } catch {
      return null;
    }
  },

  clearProgress: async (): Promise<void> => {
    try {
      await request("/api/user/progress", { method: "DELETE" });
    } catch {}
  },
};

