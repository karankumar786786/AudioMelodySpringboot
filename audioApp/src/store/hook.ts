import {configureStore} from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import deviceReducer from "./deviceSlice";
import tempTokenReducer from "./tempTokenSlice";
import userReducer from "./userSlice";

export const store = configureStore({
    reducer: {
        auth: authReducer,
        device: deviceReducer,
        tempToken: tempTokenReducer,
        user: userReducer,
    }
});

export type AppState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
