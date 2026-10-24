import * as SecuredStorage from "expo-secure-store";
import {randomUUID} from "expo-crypto";

const DEVICE_ID_KEY = "device_id";

interface Device {
    getId(): Promise<string>;
}

export const Device: Device = {
    async getId(): Promise<string> {
        const deviceId = await SecuredStorage.getItemAsync(DEVICE_ID_KEY);
        if (deviceId) {
            return deviceId;
        }
        const newDeviceId = randomUUID();
        await SecuredStorage.setItemAsync(DEVICE_ID_KEY, newDeviceId);
        return newDeviceId;
    },
}