import axios from "axios";
import {
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  RegisterRequest,
  RegisterResponse,
  ResendOtpRequest,
  ResendOtpResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
} from "@/types";
import { api } from "./baseApi";
import type { AuthService } from "@/types/service/AuthService";

const getAuthBaseUrl = () => {
  const base = api.defaults.baseURL || "http://192.168.0.105:9090";
  return base.replace(/\/api\/?$/, "");
};

export const authService: AuthService = {
  async register(request: RegisterRequest): Promise<RegisterResponse> {
    const res = await axios.post<RegisterResponse>(
      `${getAuthBaseUrl()}/auth/register`,
      request,
    );
    return res.data;
  },
  async login(request: LoginRequest): Promise<LoginResponse> {
    const res = await axios.post<LoginResponse>(
      `${getAuthBaseUrl()}/auth/login`,
      request,
    );
    return res.data;
  },
  async verifyOtp(request: VerifyOtpRequest): Promise<VerifyOtpResponse> {
    const res = await axios.post<VerifyOtpResponse>(
      `${getAuthBaseUrl()}/auth/verify-otp`,
      request,
    );
    return res.data;
  },
  async resendOtp(request: ResendOtpRequest): Promise<ResendOtpResponse> {
    const res = await axios.post<ResendOtpResponse>(
      `${getAuthBaseUrl()}/auth/resend-otp`,
      request,
    );
    return res.data;
  },
  async refreshToken(
    request: RefreshTokenRequest,
  ): Promise<RefreshTokenResponse> {
    const res = await axios.post<RefreshTokenResponse>(
      `${getAuthBaseUrl()}/auth/refresh-token`,
      request,
    );
    return res.data;
  },
};
