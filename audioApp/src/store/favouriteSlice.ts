import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { Song } from "@/types";
import { favouriteService } from "@/service/favouriteService";

export interface FavouriteState {
  favouriteIds: string[];
  favouriteSongs: Song[];
  isLoading: boolean;
  error: string | null;
}

const initialState: FavouriteState = {
  favouriteIds: [],
  favouriteSongs: [],
  isLoading: false,
  error: null,
};

export const loadFavourites = createAsyncThunk(
  "favourites/loadFavourites",
  async (_, { rejectWithValue }) => {
    try {
      const response = await favouriteService.getFavourites(0, 100);
      return response.content || [];
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to load favourites");
    }
  }
);

export const toggleFavourite = createAsyncThunk<
  { song: Song; wasLiked: boolean },
  Song,
  { state: { favourites: FavouriteState }; rejectValue: { song: Song; wasLiked: boolean; error: string } }
>(
  "favourites/toggleFavourite",
  async (song: Song, { getState, rejectWithValue }) => {
    const state = getState();
    const isCurrentlyLiked = state.favourites.favouriteIds.includes(song.id);

    try {
      if (isCurrentlyLiked) {
        await favouriteService.removeFavourite(song.id);
      } else {
        await favouriteService.addFavourite(song.id);
      }
      return { song, wasLiked: isCurrentlyLiked };
    } catch (err: any) {
      return rejectWithValue({
        song,
        wasLiked: isCurrentlyLiked,
        error: err.message || "Toggle favourite failed",
      });
    }
  }
);

export const favouriteSlice = createSlice({
  name: "favourites",
  initialState,
  reducers: {
    setFavourites: (state, action: PayloadAction<Song[]>) => {
      state.favouriteSongs = action.payload;
      state.favouriteIds = action.payload.map((s) => s.id);
    },
    optimisticAddFavourite: (state, action: PayloadAction<Song>) => {
      const song = action.payload;
      if (!state.favouriteIds.includes(song.id)) {
        state.favouriteIds.unshift(song.id);
        state.favouriteSongs.unshift(song);
      }
    },
    optimisticRemoveFavourite: (state, action: PayloadAction<string>) => {
      const songId = action.payload;
      state.favouriteIds = state.favouriteIds.filter((id) => id !== songId);
      state.favouriteSongs = state.favouriteSongs.filter((s) => s.id !== songId);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadFavourites.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadFavourites.fulfilled, (state, action) => {
        state.isLoading = false;
        state.favouriteSongs = action.payload;
        state.favouriteIds = action.payload.map((s) => s.id);
      })
      .addCase(loadFavourites.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Immediate optimistic update on toggle invocation
      .addCase(toggleFavourite.pending, (state, action) => {
        const song = action.meta.arg;
        const index = state.favouriteIds.indexOf(song.id);
        if (index >= 0) {
          state.favouriteIds.splice(index, 1);
          state.favouriteSongs = state.favouriteSongs.filter((s) => s.id !== song.id);
        } else {
          state.favouriteIds.unshift(song.id);
          state.favouriteSongs.unshift(song);
        }
      })
      // Rollback on rejection
      .addCase(toggleFavourite.rejected, (state, action) => {
        const payload = action.payload;
        if (!payload) return;
        const { song, wasLiked } = payload;
        if (wasLiked) {
          if (!state.favouriteIds.includes(song.id)) {
            state.favouriteIds.unshift(song.id);
            state.favouriteSongs.unshift(song);
          }
        } else {
          state.favouriteIds = state.favouriteIds.filter((id) => id !== song.id);
          state.favouriteSongs = state.favouriteSongs.filter((s) => s.id !== song.id);
        }
      });
  },
});

export const { setFavourites, optimisticAddFavourite, optimisticRemoveFavourite } =
  favouriteSlice.actions;

export const selectIsFavourite = (
  state: { favourites: FavouriteState },
  songId?: string | null
): boolean => {
  if (!songId) return false;
  return state.favourites.favouriteIds.includes(songId);
};

export default favouriteSlice.reducer;

