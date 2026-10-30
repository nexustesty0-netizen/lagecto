import type { Profile } from "@/lib/types";

export type AdminRole = NonNullable<Profile["admin_role"]>;

export function normalizeAdminRole(role?: string | null): AdminRole {
  if (role === "super_admin" || role === "manager" || role === "staff" || role === "clerk") return role;
  return "staff";
}

export function isManager(profile?: Pick<Profile, "admin_role"> | null) {
  return profile?.admin_role === "manager";
}

export function isSuperAdmin(profile?: Pick<Profile, "admin_role"> | null) {
  return profile?.admin_role === "super_admin";
}

export function canSeeAdminLogs(profile?: Pick<Profile, "admin_role"> | null) {
  return !isManager(profile);
}

export function canAssignAdminRoles(profile?: Pick<Profile, "admin_role"> | null) {
  return !isManager(profile);
}
