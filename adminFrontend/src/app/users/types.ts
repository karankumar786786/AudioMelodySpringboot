export interface UserItem {
  id: string;
  userName?: string | null;
  name?: string | null;
  email: string;
  role: string;
  status: "ACTIVE" | "BLOCKED" | "DELETED" | string;
  createdAt?: string;
}

export type RoleFilter = "ALL" | "ADMIN" | "USER";
export type StatusFilter = "ALL" | "ACTIVE" | "BLOCKED";
export type UserActionType = "promote" | "demote" | "block" | "unblock" | "delete";
