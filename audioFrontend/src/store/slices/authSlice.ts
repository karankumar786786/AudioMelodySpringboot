import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { getDeviceId } from "@/lib/api/client";
import type { User } from "@/lib/api/types";

export interface AuthState {
  systemUser: User | null;
  deviceId: string;
  isAuthModalOpen: boolean;
  favourites: string[];
}

const getInitialUser = (): User | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("system_user");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.id) {
        return parsed as User;
      }
    }
  } catch {
    // Ignore invalid JSON
  }
  return null;
};

const initialState: AuthState = {
  systemUser: getInitialUser(),
  deviceId: typeof window !== "undefined" ? getDeviceId() : "server-device",
  isAuthModalOpen: false,
  favourites: [],
};

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setSystemUser: (state, action: PayloadAction<User | null>) => {
      state.systemUser = action.payload;
    },
    updateSystemUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.systemUser) {
        state.systemUser = { ...state.systemUser, ...action.payload };
      }
    },
    setDeviceId: (state, action: PayloadAction<string>) => {
      state.deviceId = action.payload;
    },
    setIsAuthModalOpen: (state, action: PayloadAction<boolean>) => {
      state.isAuthModalOpen = action.payload;
    },
    setFavourites: (state, action: PayloadAction<string[]>) => {
      state.favourites = action.payload;
    },
    addFavourite: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      if (!state.favourites.includes(id)) {
        state.favourites.push(id);
      }
    },
    removeFavourite: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      state.favourites = state.favourites.filter((favId) => favId !== id);
    },
    logout: (state) => {
      state.systemUser = null;
      state.favourites = [];
      state.isAuthModalOpen = false;
    },
  },
});

export const {
  setSystemUser,
  updateSystemUser,
  setDeviceId,
  setIsAuthModalOpen,
  setFavourites,
  addFavourite,
  removeFavourite,
  logout,
} = authSlice.actions;

export default authSlice.reducer;
