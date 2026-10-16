export type AuthView = "login" | "register" | "otp" | "onboarding";

export interface AuthSuccessResult {
  accessToken: string;
  refreshToken: string;
  isNewUser: boolean;
  user: any;
}
