export interface LogoutRequest {
    deviceId: string;
    allDevices: boolean;
    refreshToken?: string;
}

export interface LogoutResponse {
    message: string;
}