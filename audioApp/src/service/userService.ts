import {
  UserProfileResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
  UserService,
  Song,
} from "@/types";
import { api } from "./baseApi";

export const userService: UserService = {
  async getProfile(): Promise<UserProfileResponse> {
    const response = await api.get<UserProfileResponse>("/user/profile");
    return response.data;
  },
  async updateProfile(
    request: UpdateProfileRequest,
  ): Promise<UpdateProfileResponse> {
    const response = await api.put<UpdateProfileResponse>(
      "/user/profile",
      request,
    );
    return response.data;
  },
  async getRecentlyPlayed(): Promise<Song[]> {
    try {
      const response = await api.get<any[]>("/user/history/recent");
      if (!Array.isArray(response.data)) return [];
      return response.data
        .filter(Boolean)
        .map((item) => {
          const songObj = item.song || item;
          return {
            id: String(songObj.songId || songObj.id),
            title: songObj.title || "",
            artistName: songObj.artistName || "",
            album: songObj.album || undefined,
            duration: Number(songObj.duration || 0),
            imageKey: songObj.imageKey || undefined,
            songKey: songObj.songKey || undefined,
            audioKey: songObj.songKey || songObj.audioKey || undefined,
            videoKey: songObj.videoKey || undefined,
            fullVideoKey: songObj.fullVideoKey || undefined,
            genre: songObj.genre || undefined,
            language: songObj.language || undefined,
            totalStreams: songObj.totalStreams || undefined,
          };
        });
    } catch {
      return [];
    }
  },
};
