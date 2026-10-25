import { api } from "./baseApi";
import { LogoutRequest, SessionService } from "@/types";

export const sessionService: SessionService = {
  async logout(request: LogoutRequest): Promise<void> {
    await api.post("/user/sessions/logout", {
      deviceId: request.deviceId,
      allDevices: request.allDevices,
      refreshToken: request.refreshToken,
    });
  },
};
