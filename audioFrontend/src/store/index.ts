import { configureStore } from "@reduxjs/toolkit";
import { listenerMiddleware } from "./listenerMiddleware";
import authReducer from "./slices/authSlice";
import playerReducer from "./slices/playerSlice";
import previewReducer from "./slices/previewSlice";
import queueReducer from "./slices/queueSlice";
import uiReducer from "./slices/uiSlice";

export const store = configureStore({
  reducer: {
    player: playerReducer,
    queue: queueReducer,
    auth: authReducer,
    ui: uiReducer,
    preview: previewReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(listenerMiddleware.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
