import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { Song } from "@/types";

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
      const { favouriteService } = await import("@/service/favouriteService");
      const response = await favouriteService.getFavourites(0, 100);
      const list = response?.content || (Array.isArray(response) ? response : []);
      return list as Song[];
    } catch (err: any) {
      console.warn("[favouriteSlice] Failed to load favourites:", err?.message || err);
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
  async (song: Song, { getState, dispatch, rejectWithValue }) => {
    const sid = String(song.id);
    const state = getState();
    // 1. Accurately capture initial liked state BEFORE mutating
    const wasLiked = state.favourites.favouriteIds.some((id) => String(id) === sid);

    // 2. Synchronous optimistic UI update for instant feedback across all screens
    dispatch(favouriteSlice.actions.optimisticToggle(song));

    try {
      const { favouriteService } = await import("@/service/favouriteService");
      // 3. Make correct API call matching audioFrontend
      if (wasLiked) {
        await favouriteService.removeFavourite(sid);
      } else {
        await favouriteService.addFavourite(sid);
      }
      return { song, wasLiked };
    } catch (err: any) {
      console.warn("[favouriteSlice] Toggle favourite API error, reverting:", err?.message || err);
      // 4. Revert optimistic UI update if API fails
      dispatch(favouriteSlice.actions.optimisticToggle(song));
      return rejectWithValue({
        song,
        wasLiked,
        error: err?.message || "Toggle favourite failed",
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
      state.favouriteIds = action.payload.map((s) => String(s.id));
    },
    optimisticToggle: (state, action: PayloadAction<Song>) => {
      const song = action.payload;
      const sid = String(song.id);
      const index = state.favouriteIds.findIndex((id) => String(id) === sid);
      if (index >= 0) {
        state.favouriteIds.splice(index, 1);
        state.favouriteSongs = state.favouriteSongs.filter((s) => String(s.id) !== sid);
      } else {
        state.favouriteIds.unshift(sid);
        state.favouriteSongs.unshift(song);
      }
    },
    optimisticAddFavourite: (state, action: PayloadAction<Song>) => {
      const song = action.payload;
      const sid = String(song.id);
      if (!state.favouriteIds.some((id) => String(id) === sid)) {
        state.favouriteIds.unshift(sid);
        state.favouriteSongs.unshift(song);
      }
    },
    optimisticRemoveFavourite: (state, action: PayloadAction<string>) => {
      const sid = String(action.payload);
      state.favouriteIds = state.favouriteIds.filter((id) => String(id) !== sid);
      state.favouriteSongs = state.favouriteSongs.filter((s) => String(s.id) !== sid);
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
        state.favouriteIds = action.payload.map((s) => String(s.id));
      })
      .addCase(loadFavourites.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  setFavourites,
  optimisticToggle,
  optimisticAddFavourite,
  optimisticRemoveFavourite,
} = favouriteSlice.actions;

export const selectIsFavourite = (
  state: { favourites: FavouriteState },
  songId?: string | null
): boolean => {
  if (!songId) return false;
  const sid = String(songId);
  return state.favourites.favouriteIds.some((id) => String(id) === sid);
};

export default favouriteSlice.reducer;
