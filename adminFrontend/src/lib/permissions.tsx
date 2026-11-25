"use client";

import type { ReactNode } from "react";
import { useAuth } from "./auth-context";

/**
 * Admin roles and what each may do. This mirrors the adminBackend permission classes:
 * `IsAdminUserPermission` (ADMIN and SUPER_ADMIN) and `IsSuperAdminUserPermission`
 * (SUPER_ADMIN only). The backend stays the authority; this only hides actions a role
 * would be refused. Finer roles add an entry to ROLE_PERMISSIONS.
 */
export type AdminRole = "SUPER_ADMIN" | "ADMIN";

export type Permission =
  | "song.create"
  | "song.edit"
  | "song.delete"
  | "song.feature"
  | "artist.create"
  | "artist.edit"
  | "artist.delete"
  | "playlist.create"
  | "playlist.edit"
  | "playlist.delete"
  | "user.sessions"
  | "user.block"
  /** Block or unblock an account that is itself an ADMIN. */
  | "user.blockAdmin"
  | "user.promote"
  | "user.demote"
  | "user.delete"
  | "job.retry"
  | "job.recover"
  | "job.delete"
  | "job.purgeFailed"
  | "catalog.resync"
  /** Upload a short as One Melody. */
  | "short.create"
  /** Hide, unhide or delete shorts, and resolve reports. */
  | "short.moderate"
  /** Stop an account from posting shorts. */
  | "short.ban"
  /** POST /admin/jobs/sync-metadata: reconcile counts and resync search/recommendations. */
  | "system.syncMetadata";

const ADMIN_PERMISSIONS: Permission[] = [
  "song.create",
  "song.edit",
  "song.delete",
  "song.feature",
  "artist.create",
  "artist.edit",
  "artist.delete",
  "playlist.create",
  "playlist.edit",
  "playlist.delete",
  "user.sessions",
  "user.block",
  "job.retry",
  "job.recover",
  "job.delete",
  "catalog.resync",
  "short.create",
  "short.moderate",
  "short.ban",
];

const SUPER_ADMIN_ONLY: Permission[] = [
  "user.blockAdmin",
  "user.promote",
  "user.demote",
  "user.delete",
  "job.purgeFailed",
  "system.syncMetadata",
];

export const ROLE_PERMISSIONS: Record<AdminRole, ReadonlySet<Permission>> = {
  ADMIN: new Set(ADMIN_PERMISSIONS),
  SUPER_ADMIN: new Set([...ADMIN_PERMISSIONS, ...SUPER_ADMIN_ONLY]),
};

export function normalizeRole(
  role: string | null | undefined,
): AdminRole | null {
  const r = (role ?? "").toUpperCase().replace(/[\s-]/g, "_");
  if (r === "SUPER_ADMIN" || r === "SUPERADMIN") return "SUPER_ADMIN";
  if (r === "ADMIN") return "ADMIN";
  return null;
}

export function can(
  role: string | null | undefined,
  permission: Permission,
): boolean {
  const r = normalizeRole(role);
  return r ? ROLE_PERMISSIONS[r].has(permission) : false;
}

export function usePermissions() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  return {
    role,
    isSuperAdmin: role === "SUPER_ADMIN",
    can: (permission: Permission) => can(role, permission),
  };
}

/** Renders `children` only when the current role has `permission`. */
export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can: allowed } = usePermissions();
  return <>{allowed(permission) ? children : fallback}</>;
}
