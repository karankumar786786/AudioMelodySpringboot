import {configureStore} from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import deviceReducer from "./deviceSlice";
import tempTokenReducer from "./tempTokenSlice";

export const store = configureStore({
    reducer: {
        auth: authReducer,
        device: deviceReducer,
        tempToken: tempTokenReducer,
    }
});

export type AppState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
