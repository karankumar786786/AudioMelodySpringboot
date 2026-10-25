import { LoginRequest, LoginResponse } from "../api/LoginApi";
import {
  RefreshTokenRequest,
  RefreshTokenResponse,
} from "../api/RefreshTokenApi";
import { RegisterRequest, RegisterResponse } from "../api/RegisterApi";
import { ResendOtpRequest, ResendOtpResponse } from "../api/ResendOtpApi";
import { VerifyOtpRequest, VerifyOtpResponse } from "../api/VerifyOtpApi";

export interface AuthService {
  register(request: RegisterRequest): Promise<RegisterResponse>;
  login(request: LoginRequest): Promise<LoginResponse>;
  verifyOtp(request: VerifyOtpRequest): Promise<VerifyOtpResponse>;
  resendOtp(request: ResendOtpRequest): Promise<ResendOtpResponse>;
  refreshToken(request: RefreshTokenRequest): Promise<RefreshTokenResponse>;
}
