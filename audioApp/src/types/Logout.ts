export interface LogoutRequest {
    refreshToken: string;
    deviceId: string;
    allDevices: boolean;
}

export interface LogoutResponse {
    message: string;
}