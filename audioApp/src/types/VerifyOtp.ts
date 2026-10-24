import { AuthToken } from "./AuthToken";

export interface VerifyOtpRequest {
    tempToken: string;
    otp: string;
    deviceId: string;
}

export interface VerifyOtpResponse extends AuthToken {
    isNewUser: boolean;
}