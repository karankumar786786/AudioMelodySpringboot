import { Device } from "@/storage/Device";
import { type Device as DeviceType } from "@/types/Device";
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";


const initialState: DeviceType = {
    deviceId: "",
};

export const loadDevice = createAsyncThunk(
    "device/getDeviceId",
    async () => {
        const deviceId = await Device.getId();
        return deviceId;
    }
)

export const deviceSlice = createSlice({
    name: "device",
    initialState,
    reducers: {
        setDeviceId: (state, action: PayloadAction<string>) => {
            state.deviceId = action.payload;
        },
    },
    extraReducers: (builder) => {
        builder.addCase(loadDevice.fulfilled, (state, action) => {
            state.deviceId = action.payload;
        })
    },
});

export const { setDeviceId } = deviceSlice.actions;
export default deviceSlice.reducer;