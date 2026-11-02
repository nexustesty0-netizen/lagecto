import { isPlatformOwnerEmail } from "@/lib/brand";
import type { Profile } from "@/lib/types";

export type AdminRole = "super_admin" | "admin" | "manager";

type AdminProfile = Pick<Profile, "admin_role"> & { email?: string | null };

const SUPER_ADMIN_ONLY_PATHS = ["/admin/security", "/admin/company", "/admin/languages", "/admin/chat"];
const ADMIN_MIN_PATHS = [
  "/admin/ads",
  "/admin/loyalty",
  "/admin/badges",
  "/admin/campaigns",
  "/admin/promo-codes",
  "/admin/payments",
  "/admin/subscriptions",
  "/admin/pos",
  "/admin/expenses",
  "/admin/stebo",
  "/admin/notifications",
  "/admin/settings",
];

export function canViewAccountContact(profile?: AdminProfile | null) {
  return hasAdminLevel(profile, "admin");
}

export function canRestrictAccounts(profile?: AdminProfile | null) {
  return isSuperAdmin(profile);
}

function pathMatches(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => {
    if (prefix.endsWith("/")) return pathname.startsWith(prefix);
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}

export function normalizeAdminRole(role?: string | null): AdminRole {
  if (role === "super_admin") return "super_admin";
  if (role === "manager") return "manager";
  return "admin";
}

export function effectiveAdminRole(profile?: AdminProfile | null): AdminRole {
  if (!profile) return "manager";
  if (isPlatformOwnerEmail(profile.email) || profile.admin_role === "super_admin") return "super_admin";
  return normalizeAdminRole(profile.admin_role);
}

export function adminRoleLabel(role?: string | null) {
  const normalized = normalizeAdminRole(role);
  if (normalized === "super_admin") return "Super admin";
  if (normalized === "manager") return "Manager";
  return "Admin";
}

export function isManager(profile?: AdminProfile | null) {
  return effectiveAdminRole(profile) === "manager";
}

export function isSuperAdmin(profile?: AdminProfile | null) {
  return effectiveAdminRole(profile) === "super_admin";
}

export function hasAdminLevel(profile: AdminProfile | null | undefined, min: AdminRole) {
  const rank = { manager: 1, admin: 2, super_admin: 3 };
  return rank[effectiveAdminRole(profile)] >= rank[min];
}

export function canSeeAdminLogs(profile?: AdminProfile | null) {
  return isSuperAdmin(profile);
}

export function canAssignAdminRoles(profile?: AdminProfile | null) {
  return !isManager(profile);
}

export function canAssignSuperAdmin(profile?: AdminProfile | null) {
  return isSuperAdmin(profile);
}

export function canRegenerateShopId(profile?: AdminProfile | null) {
  return hasAdminLevel(profile, "admin");
}

export function canAssignShopPlans(profile?: AdminProfile | null) {
  return hasAdminLevel(profile, "admin");
}

export function canManagePlatformSettings(profile?: AdminProfile | null) {
  return isSuperAdmin(profile);
}

export function canDeleteShops(profile?: AdminProfile | null) {
  return isSuperAdmin(profile);
}

export function canDeleteUsers(profile?: AdminProfile | null) {
  return isSuperAdmin(profile);
}

export function adminPathAllowed(profile: AdminProfile | null | undefined, pathname: string) {
  const role = effectiveAdminRole(profile);
  if (role === "super_admin") return true;
  if (pathMatches(pathname, SUPER_ADMIN_ONLY_PATHS)) return false;
  if (role === "admin") return true;
  return !pathMatches(pathname, ADMIN_MIN_PATHS);
}
