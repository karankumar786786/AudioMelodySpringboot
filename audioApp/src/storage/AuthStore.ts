import { AuthToken } from "@/types/AuthToken";
import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";

interface AuthStore{
    saveAuthTokenToSecureStorage(token:AuthToken): Promise<void>;
    getAuthTokenFromSecureStorage(): Promise<AuthToken>;
    clearAuthToken(): Promise<void>;
}

export const AuthStore: AuthStore = {
    async saveAuthTokenToSecureStorage(token: AuthToken): Promise<void> {
        await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token.accessToken);
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token.refreshToken);
    },
    async getAuthTokenFromSecureStorage(): Promise<AuthToken> {
        const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
        const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
        return {accessToken: accessToken || "", refreshToken: refreshToken || ""}
    },
    async clearAuthToken(): Promise<void> {
        await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    },
};