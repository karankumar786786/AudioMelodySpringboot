import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { UserProfile } from "@/types";
import { clearAuthToken } from "./authSlice";

export interface UserState {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: UserState = {
  profile: null,
  isLoading: false,
  error: null,
};

export const loadUserProfile = createAsyncThunk(
  "user/loadUserProfile",
  async (): Promise<UserProfile> => {
    const { userService } = await import("@/service/userService");
    const profile = await userService.getProfile();
    return profile;
  }
);

export const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUserProfile: (state, action: PayloadAction<UserProfile | null>) => {
      state.profile = action.payload;
      state.isLoading = false;
      state.error = null;
    },
    clearUserProfile: (state) => {
      state.profile = null;
      state.isLoading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadUserProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadUserProfile.fulfilled, (state, action) => {
        state.profile = action.payload;
        state.isLoading = false;
        state.error = null;
      })
      .addCase(loadUserProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || "Failed to load user profile";
      })
      .addCase(clearAuthToken.fulfilled, (state) => {
        state.profile = null;
        state.isLoading = false;
        state.error = null;
      });
  },
});

export const { setUserProfile, clearUserProfile } = userSlice.actions;
export default userSlice.reducer;
