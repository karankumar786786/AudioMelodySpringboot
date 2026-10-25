import {configureStore} from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import deviceReducer from "./deviceSlice";
import tempTokenReducer from "./tempTokenSlice";
import userReducer from "./userSlice";
import playerReducer from "./playerSlice";
import queueReducer from "./queueSlice";

export const store = configureStore({
    reducer: {
        auth: authReducer,
        device: deviceReducer,
        tempToken: tempTokenReducer,
        user: userReducer,
        player: playerReducer,
        queue: queueReducer,
    }
});

export type AppState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
