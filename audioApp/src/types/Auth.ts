import { LoginRequest, LoginResponse } from "./Login";
import { LogoutRequest, LogoutResponse } from "./Logout";
import { RefreshTokenRequest, RefreshTokenResponse } from "./RefreshToken";
import { RegisterRequest, RegisterResponse } from "./Register";
import { ResendOtpRequest, ResendOtpResponse } from "./ResendOtp";
import { VerifyOtpRequest, VerifyOtpResponse } from "./VerifyOtp";


export interface Auth {
    register(request: RegisterRequest): Promise<RegisterResponse>;
    login(request: LoginRequest): Promise<LoginResponse>;
    verifyOtp(request: VerifyOtpRequest): Promise<VerifyOtpResponse>;
    resendOtp(request: ResendOtpRequest): Promise<ResendOtpResponse>;
    refreshToken(request: RefreshTokenRequest): Promise<RefreshTokenResponse>;
    logout(request:LogoutRequest): Promise<LogoutResponse>;
}