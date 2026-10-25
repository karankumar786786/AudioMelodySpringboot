export interface Session {
  userId: string;
  email: string;
  userName: string;
  isAuthenticated: boolean;
}

export interface UserSession {
  id: string;
  deviceId: string;
  deviceName?: string;
  ipAddress?: string;
  location?: string;
  lastActiveAt?: string;
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
  isCurrent: boolean;
}