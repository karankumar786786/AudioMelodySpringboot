import { LoginRequest, LoginResponse, RefreshTokenRequest, RefreshTokenResponse, RegisterRequest, RegisterResponse } from "@/types"

interface Auth{
    register(request:RegisterRequest): Promise<RegisterResponse>;
    login(request:LoginRequest): Promise<LoginResponse>;

    refreshToken(request:RefreshTokenRequest):Promise<RefreshTokenResponse>;
    
}

export const Auth:Auth = {
    register(request: RegisterRequest): Promise<RegisterResponse> {
        throw new Error("Method not implemented.");
    },
    login(request:LoginRequest): Promise<LoginResponse> {
        throw new Error("Method not implemented.");
    },
    refreshToken(request:RefreshTokenRequest): Promise<RefreshTokenResponse> {
        throw new Error("Method not implemented.");
    }
}