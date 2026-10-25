import { LogoutRequest } from "../api/LogoutApi";
import { UserSession } from "../entity/SessionEntity";

export interface SessionService {
  logout(request: LogoutRequest): Promise<void>;
  getSessions(deviceId: string): Promise<UserSession[]>;
  revokeSession(sessionId: string): Promise<void>;
  revokeOtherSessions(deviceId: string): Promise<void>;
}
