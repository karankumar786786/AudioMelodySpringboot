import { api } from "./baseApi";
import { LogoutRequest, SessionService, UserSession } from "@/types";

export const sessionService: SessionService = {
  async logout(request: LogoutRequest): Promise<void> {
    await api.post("/user/sessions/logout", {
      deviceId: request.deviceId,
      allDevices: request.allDevices,
      refreshToken: request.refreshToken,
    });
  },

  async getSessions(deviceId: string): Promise<UserSession[]> {
    const response = await api.get<UserSession[]>(
      `/user/sessions?deviceId=${encodeURIComponent(deviceId)}`
    );
    return response.data || [];
  },

  async revokeSession(sessionId: string): Promise<void> {
    await api.delete(`/user/sessions/${encodeURIComponent(sessionId)}`);
  },

  async revokeOtherSessions(deviceId: string): Promise<void> {
    await api.post("/user/sessions/revoke-others", { deviceId });
  },
};
