import { AuthToken } from "./AuthToken";

export interface RefreshTokenRequest{
    refreshToken: string;
}
export interface RefreshTokenResponse extends AuthToken{}