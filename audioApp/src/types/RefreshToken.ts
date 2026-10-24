import { AuthToken } from "./AuthToken";

export interface RefreshTokenRequest {
    refreshToken?: string;
    deviceId?: string;
}

export interface RefreshTokenResponse extends AuthToken {}