import { api } from "./baseApi";
import { Song } from "@/types";

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

export const userProgressService = {
  async saveProgress(params: UpdateProgressParams): Promise<UserProgress | null> {
    try {
      const response = await api.post<UserProgress>("/user/progress", params);
      return response.data;
    } catch {
      return null;
    }
  },

  async getResumeState(): Promise<UserProgress | null> {
    try {
      const response = await api.get<UserProgress>("/user/progress/resume");
      return response.status === 200 && response.data?.songId ? response.data : null;
    } catch {
      return null;
    }
  },

  async clearProgress(): Promise<void> {
    try {
      await api.delete("/user/progress");
    } catch {}
  },
};
