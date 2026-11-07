import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {AuthStore} from "@/storage";
import { AuthToken } from "@/types";



const initialState:AuthToken = {
    accessToken: "",
    refreshToken: ""
};

const saveAuthToken = createAsyncThunk(
    "auth/savetokentostore",
    async (token: AuthToken):Promise<AuthToken> => {
        await AuthStore.saveAuthTokenToSecureStorage(token);
        return token;
    }
)

const loadAuthToken = createAsyncThunk(
    "auth/gettokentostore",
    async ():Promise<AuthToken> => {
        const token = await AuthStore.getAuthTokenFromSecureStorage();
        return token;
    }
)

const clearAuthToken = createAsyncThunk(
    "auth/cleartokentostore",
    async (): Promise<void> => {
        try {
            // 1. Stop audio playback and clear lock screen / media session immediately
            const { audioPlayerService } = await import("@/service/audioPlayerService");
            audioPlayerService.stopAndReset();
        } catch (e) {
            console.warn("[clearAuthToken] Error stopping audio player:", e);
        }

        try {
            // 2. Clear persisted playback state (last song, last queue, last position)
            const { PlayerStore } = await import("@/storage/PlayerStore");
            await PlayerStore.clear();
        } catch (e) {
            console.warn("[clearAuthToken] Error clearing PlayerStore:", e);
        }

        try {
            // 3. Clear recent search history
            const { searchService } = await import("@/service/searchService");
            await searchService.clearAllRecentSearches();
        } catch (e) {
            console.warn("[clearAuthToken] Error clearing search history:", e);
        }

        // 4. Clear auth tokens from SecureStore (device_id in SecureStore is preserved!)
        await AuthStore.clearAuthToken();
    }
);


export const authSlice = createSlice(
    {
        name: "auth",
        initialState: initialState,
        reducers: {
        },
        extraReducers: (builder) => {
            builder.addCase(saveAuthToken.fulfilled, (state, action) => {
                state.accessToken = action.payload.accessToken;
                state.refreshToken = action.payload.refreshToken;
            })
            builder.addCase(loadAuthToken.fulfilled, (state, action) => {
                state.accessToken = action.payload.accessToken;
                state.refreshToken = action.payload.refreshToken;
            })
            builder.addCase(clearAuthToken.fulfilled, (state) => {
                state.accessToken = "";
                state.refreshToken = "";
            })
        }
    }
)

export {saveAuthToken, loadAuthToken, clearAuthToken};

export default authSlice.reducer;   