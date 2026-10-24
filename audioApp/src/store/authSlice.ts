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
    async ():Promise<void> => {
        await AuthStore.clearAuthToken();
    }
)


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