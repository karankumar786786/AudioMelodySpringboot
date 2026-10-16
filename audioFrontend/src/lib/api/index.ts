import { albumsApi } from "./albums";
import { artistsApi } from "./artists";
import { authApi } from "./auth";
import { interactionsApi } from "./interactions";
import { playlistsApi } from "./playlists";
import { searchApi } from "./search";
import { songsApi } from "./songs";
import { usersApi } from "./users";
import { recombeeApi } from "./recombee";

export * from "./types";
export * from "./client";
export * from "./songs";
export * from "./artists";
export * from "./playlists";
export * from "./albums";
export * from "./users";
export * from "./interactions";
export * from "./search";
export * from "./auth";
export * from "./recombee";

export const musicApi = {
  songs: songsApi,
  artists: artistsApi,
  playlists: playlistsApi,
  albums: albumsApi,
  users: usersApi,
  interactions: interactionsApi,
  search: searchApi,
  auth: authApi,
  recombee: recombeeApi,
};

export default musicApi;
