import { api } from "./baseApi";
import { Playlist, UserPlaylist, Song, PaginatedResponse } from "@/types";

export interface PlaylistService {
  // System Playlists
  getPlaylistById(id: string): Promise<Playlist>;
  getPlaylistSongs(
    id: string,
    page?: number,
    size?: number
  ): Promise<PaginatedResponse<Song>>;

  // User Playlists
  getUserPlaylists(
    page?: number,
    size?: number
  ): Promise<PaginatedResponse<UserPlaylist>>;
  getUserPlaylistById(id: string): Promise<UserPlaylist>;
  getUserPlaylistSongs(
    id: string,
    page?: number,
    size?: number
  ): Promise<PaginatedResponse<Song>>;
  createUserPlaylist(
    name: string,
    privacy?: "PUBLIC" | "PRIVATE"
  ): Promise<UserPlaylist>;
  deleteUserPlaylist(id: string): Promise<void>;
  addSongToUserPlaylist(
    playlistId: string,
    songId: string
  ): Promise<UserPlaylist>;
  removeSongFromUserPlaylist(
    playlistId: string,
    songId: string
  ): Promise<UserPlaylist>;
}

export const playlistService: PlaylistService = {
  // System Playlists
  async getPlaylistById(id: string): Promise<Playlist> {
    const response = await api.get<Playlist>(`/playlists/${encodeURIComponent(id)}`);
    return response.data;
  },

  async getPlaylistSongs(
    id: string,
    page = 0,
    size = 20
  ): Promise<PaginatedResponse<Song>> {
    const response = await api.get<PaginatedResponse<Song>>(
      `/playlists/${encodeURIComponent(id)}/songs?page=${page}&size=${size}`
    );
    return response.data;
  },

  // User Playlists
  async getUserPlaylists(
    page = 0,
    size = 20
  ): Promise<PaginatedResponse<UserPlaylist>> {
    const response = await api.get<PaginatedResponse<UserPlaylist>>(
      `/user/playlists?page=${page}&size=${size}`
    );
    return response.data;
  },

  async getUserPlaylistById(id: string): Promise<UserPlaylist> {
    const response = await api.get<UserPlaylist>(
      `/user/playlists/${encodeURIComponent(id)}`
    );
    return response.data;
  },

  async getUserPlaylistSongs(
    id: string,
    page = 0,
    size = 20
  ): Promise<PaginatedResponse<Song>> {
    const response = await api.get<PaginatedResponse<Song>>(
      `/user/playlists/${encodeURIComponent(id)}/songs?page=${page}&size=${size}`
    );
    return response.data;
  },

  async createUserPlaylist(
    name: string,
    privacy: "PUBLIC" | "PRIVATE" = "PUBLIC"
  ): Promise<UserPlaylist> {
    const response = await api.post<UserPlaylist>("/user/playlists", {
      name,
      privacy,
    });
    return response.data;
  },

  async deleteUserPlaylist(id: string): Promise<void> {
    await api.delete(`/user/playlists/${encodeURIComponent(id)}`);
  },

  async addSongToUserPlaylist(
    playlistId: string,
    songId: string
  ): Promise<UserPlaylist> {
    const response = await api.post<UserPlaylist>(
      `/user/playlists/${encodeURIComponent(playlistId)}/songs`,
      { songId }
    );
    return response.data;
  },

  async removeSongFromUserPlaylist(
    playlistId: string,
    songId: string
  ): Promise<UserPlaylist> {
    const response = await api.delete<UserPlaylist>(
      `/user/playlists/${encodeURIComponent(playlistId)}/songs/${encodeURIComponent(songId)}`
    );
    return response.data;
  },
};
