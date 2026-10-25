import { LogoutRequest } from "../api/LogoutApi";

export interface SessionService {
  logout(request: LogoutRequest): Promise<void>;
}
