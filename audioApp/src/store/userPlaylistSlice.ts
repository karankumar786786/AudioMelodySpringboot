import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { UserPlaylist, Song } from "@/types";
import { clearAuthToken } from "./authSlice";

export interface UserPlaylistState {
  playlists: UserPlaylist[];
  playlistSongMap: Record<string, string[]>;
  isLoading: boolean;
  error: string | null;
}

const initialState: UserPlaylistState = {
  playlists: [],
  playlistSongMap: {},
  isLoading: false,
  error: null,
};

export const loadUserPlaylists = createAsyncThunk<
  UserPlaylist[],
  void,
  { rejectValue: string }
>(
  "userPlaylists/loadUserPlaylists",
  async (_, { rejectWithValue }) => {
    try {
      const { playlistService } = await import("@/service/playlistService");
      const response = await playlistService.getUserPlaylists(0, 100);
      const list = response?.content || (Array.isArray(response) ? response : []);
      return list as UserPlaylist[];
    } catch (err: any) {
      console.warn("[userPlaylistSlice] Failed to load playlists:", err?.message || err);
      return rejectWithValue(err?.message || "Failed to load playlists");
    }
  }
);

export const loadPlaylistSongs = createAsyncThunk<
  { playlistId: string; songIds: string[] },
  string,
  { rejectValue: string }
>(
  "userPlaylists/loadPlaylistSongs",
  async (playlistId: string, { rejectWithValue }) => {
    try {
      const { playlistService } = await import("@/service/playlistService");
      const response = await playlistService.getUserPlaylistSongs(playlistId, 0, 100);
      const songs = response?.content || (Array.isArray(response) ? response : []);
      const songIds = (songs as Song[]).map((s) => String(s.id));
      return { playlistId, songIds };
    } catch (err: any) {
      return rejectWithValue(err?.message || "Failed to load playlist songs");
    }
  }
);

export const createUserPlaylist = createAsyncThunk<
  UserPlaylist,
  { name: string; privacy?: "PUBLIC" | "PRIVATE" | "SHARE_BY_LINK" },
  { rejectValue: string }
>(
  "userPlaylists/createUserPlaylist",
  async ({ name, privacy = "PRIVATE" }, { rejectWithValue }) => {
    try {
      const { playlistService } = await import("@/service/playlistService");
      const created = await playlistService.createUserPlaylist(name, privacy);
      return created;
    } catch (err: any) {
      return rejectWithValue(err?.message || "Failed to create playlist");
    }
  }
);

export const deleteUserPlaylist = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>(
  "userPlaylists/deleteUserPlaylist",
  async (playlistId: string, { rejectWithValue }) => {
    try {
      const { playlistService } = await import("@/service/playlistService");
      await playlistService.deleteUserPlaylist(playlistId);
      return playlistId;
    } catch (err: any) {
      return rejectWithValue(err?.message || "Failed to delete playlist");
    }
  }
);

export const addSongToUserPlaylist = createAsyncThunk<
  { playlistId: string; songId: string },
  { playlistId: string; songId: string },
  { state: { userPlaylists: UserPlaylistState }; rejectValue: string }
>(
  "userPlaylists/addSongToUserPlaylist",
  async ({ playlistId, songId }, { dispatch, rejectWithValue }) => {
    const sId = String(songId);
    dispatch(userPlaylistSlice.actions.optimisticAddSong({ playlistId, songId: sId }));
    try {
      const { playlistService } = await import("@/service/playlistService");
      await playlistService.addSongToUserPlaylist(playlistId, sId);
      return { playlistId, songId: sId };
    } catch (err: any) {
      if (err?.response?.status === 409) {
        return { playlistId, songId: sId };
      }
      dispatch(userPlaylistSlice.actions.optimisticRemoveSong({ playlistId, songId: sId }));
      return rejectWithValue(err?.response?.data?.message || err?.message || "Failed to add song to playlist");
    }
  }
);

export const removeSongFromUserPlaylist = createAsyncThunk<
  { playlistId: string; songId: string },
  { playlistId: string; songId: string },
  { state: { userPlaylists: UserPlaylistState }; rejectValue: string }
>(
  "userPlaylists/removeSongFromUserPlaylist",
  async ({ playlistId, songId }, { dispatch, rejectWithValue }) => {
    const sId = String(songId);
    dispatch(userPlaylistSlice.actions.optimisticRemoveSong({ playlistId, songId: sId }));
    try {
      const { playlistService } = await import("@/service/playlistService");
      await playlistService.removeSongFromUserPlaylist(playlistId, sId);
      return { playlistId, songId: sId };
    } catch (err: any) {
      if (err?.response?.status === 404) {
        return { playlistId, songId: sId };
      }
      dispatch(userPlaylistSlice.actions.optimisticAddSong({ playlistId, songId: sId }));
      return rejectWithValue(err?.response?.data?.message || err?.message || "Failed to remove song from playlist");
    }
  }
);

export const updateUserPlaylistPrivacy = createAsyncThunk<
  UserPlaylist,
  { playlistId: string; privacy: "PUBLIC" | "PRIVATE" | "SHARE_BY_LINK" },
  { rejectValue: string }
>(
  "userPlaylists/updateUserPlaylistPrivacy",
  async ({ playlistId, privacy }, { rejectWithValue }) => {
    try {
      const { playlistService } = await import("@/service/playlistService");
      const updated = await playlistService.updatePlaylistPrivacy(playlistId, privacy);
      return updated;
    } catch (err: any) {
      return rejectWithValue(err?.response?.data?.message || err?.message || "Failed to update privacy");
    }
  }
);

export const userPlaylistSlice = createSlice({
  name: "userPlaylists",
  initialState,
  reducers: {
    setPlaylists: (state, action: PayloadAction<UserPlaylist[]>) => {
      state.playlists = action.payload;
    },
    optimisticAddSong: (
      state,
      action: PayloadAction<{ playlistId: string; songId: string }>
    ) => {
      const { playlistId, songId } = action.payload;
      const pl = state.playlists.find((p) => p.id === playlistId);
      if (pl) {
        pl.totalSongs = (pl.totalSongs || 0) + 1;
      }
      const existing = state.playlistSongMap[playlistId] || [];
      if (!existing.includes(songId)) {
        state.playlistSongMap[playlistId] = [songId, ...existing];
      }
    },
    optimisticRemoveSong: (
      state,
      action: PayloadAction<{ playlistId: string; songId: string }>
    ) => {
      const { playlistId, songId } = action.payload;
      const pl = state.playlists.find((p) => p.id === playlistId);
      if (pl && pl.totalSongs > 0) {
        pl.totalSongs -= 1;
      }
      const existing = state.playlistSongMap[playlistId] || [];
      state.playlistSongMap[playlistId] = existing.filter((id) => id !== songId);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadUserPlaylists.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadUserPlaylists.fulfilled, (state, action) => {
        state.isLoading = false;
        state.playlists = action.payload;
      })
      .addCase(loadUserPlaylists.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || "Failed to load playlists";
      })
      .addCase(createUserPlaylist.fulfilled, (state, action) => {
        state.playlists.unshift(action.payload);
        // Pre-initialize empty song list in map so loadPlaylistSongs is not triggered prematurely
        state.playlistSongMap[action.payload.id] = [];
      })
      .addCase(deleteUserPlaylist.fulfilled, (state, action) => {
        state.playlists = state.playlists.filter((p) => p.id !== action.payload);
        delete state.playlistSongMap[action.payload];
      })
      .addCase(updateUserPlaylistPrivacy.fulfilled, (state, action) => {
        const idx = state.playlists.findIndex((p) => p.id === action.payload.id);
        if (idx !== -1) {
          state.playlists[idx] = action.payload;
        }
      })
      .addCase(addSongToUserPlaylist.fulfilled, (state, action) => {
        const { playlistId, songId } = action.payload;
        const existing = state.playlistSongMap[playlistId] || [];
        if (!existing.includes(songId)) {
          state.playlistSongMap[playlistId] = [songId, ...existing];
        }
        const pl = state.playlists.find((p) => p.id === playlistId);
        if (pl) {
          pl.totalSongs = Math.max(pl.totalSongs || 0, state.playlistSongMap[playlistId].length);
        }
      })
      .addCase(removeSongFromUserPlaylist.fulfilled, (state, action) => {
        const { playlistId, songId } = action.payload;
        const existing = state.playlistSongMap[playlistId] || [];
        state.playlistSongMap[playlistId] = existing.filter((id) => id !== songId);
        const pl = state.playlists.find((p) => p.id === playlistId);
        if (pl && pl.totalSongs > 0) {
          pl.totalSongs = Math.max(0, pl.totalSongs - 1);
        }
      })
      .addCase(loadPlaylistSongs.fulfilled, (state, action) => {
        const { playlistId, songIds } = action.payload;
        const existing = state.playlistSongMap[playlistId] || [];
        // Preserve any songs that were added locally and may not have reached server yet
        const merged = Array.from(new Set([...existing, ...songIds]));
        state.playlistSongMap[playlistId] = merged;
        const pl = state.playlists.find((p) => p.id === playlistId);
        if (pl && merged.length > pl.totalSongs) {
          pl.totalSongs = merged.length;
        }
      })
      .addCase(clearAuthToken.fulfilled, () => {
        return initialState;
      });
  },
});

export const {
  setPlaylists,
  optimisticAddSong,
  optimisticRemoveSong,
} = userPlaylistSlice.actions;

export const selectAllUserPlaylists = (state: { userPlaylists: UserPlaylistState }): UserPlaylist[] =>
  state.userPlaylists.playlists;

export const selectUserPlaylistsLoading = (state: { userPlaylists: UserPlaylistState }): boolean =>
  state.userPlaylists.isLoading;

export const selectIsSongInPlaylist = (
  state: { userPlaylists: UserPlaylistState },
  playlistId: string,
  songId?: string | null
): boolean => {
  if (!songId || !playlistId) return false;
  const list = state.userPlaylists.playlistSongMap[playlistId];
  if (!list) return false;
  return list.includes(String(songId));
};

export const selectIsSongInAnyPlaylist = (
  state: { userPlaylists: UserPlaylistState },
  songId?: string | null
): boolean => {
  if (!songId) return false;
  const sId = String(songId);
  return Object.values(state.userPlaylists.playlistSongMap).some((songs) =>
    songs.includes(sId)
  );
};

export const selectPlaylistsContainingSong = (
  state: { userPlaylists: UserPlaylistState },
  songId?: string | null
): string[] => {
  if (!songId) return [];
  const sId = String(songId);
  return Object.entries(state.userPlaylists.playlistSongMap)
    .filter(([_, songs]) => songs.includes(sId))
    .map(([playlistId]) => playlistId);
};

export default userPlaylistSlice.reducer;

