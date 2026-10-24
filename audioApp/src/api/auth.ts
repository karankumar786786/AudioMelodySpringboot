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
    VerifyOtpResponse
} from "@/types";
import { api } from "./api";

const getAuthBaseUrl = () => {
    const base = api.defaults.baseURL || "http://localhost:8080";
    return base.replace(/\/api\/?$/, "");
};

interface Auth {
    register(request: RegisterRequest): Promise<RegisterResponse>;
    login(request: LoginRequest): Promise<LoginResponse>;
    verifyOtp(request: VerifyOtpRequest): Promise<VerifyOtpResponse>;
    resendOtp(request: ResendOtpRequest): Promise<ResendOtpResponse>;
    refreshToken(request: RefreshTokenRequest): Promise<RefreshTokenResponse>;
    logout(deviceId?: string): Promise<{ message: string }>;
}

export const Auth: Auth = {
    async register(request: RegisterRequest): Promise<RegisterResponse> {
        const res = await axios.post<RegisterResponse>(`${getAuthBaseUrl()}/auth/register`, request);
        return res.data;
    },
    async login(request: LoginRequest): Promise<LoginResponse> {
        const res = await axios.post<LoginResponse>(`${getAuthBaseUrl()}/auth/login`, request);
        return res.data;
    },
    async verifyOtp(request: VerifyOtpRequest): Promise<VerifyOtpResponse> {
        const res = await axios.post<VerifyOtpResponse>(`${getAuthBaseUrl()}/auth/verify-otp`, request);
        return res.data;
    },
    async resendOtp(request: ResendOtpRequest): Promise<ResendOtpResponse> {
        const res = await axios.post<ResendOtpResponse>(`${getAuthBaseUrl()}/auth/resend-otp`, request);
        return res.data;
    },
    async refreshToken(request: RefreshTokenRequest): Promise<RefreshTokenResponse> {
        const res = await axios.post<RefreshTokenResponse>(`${getAuthBaseUrl()}/auth/refresh-token`, request);
        return res.data;
    },
    async logout(deviceId?: string): Promise<{ message: string }> {
        const res = await axios.post<{ message: string }>(`${getAuthBaseUrl()}/auth/logout`, { deviceId });
        return res.data;
    }
};