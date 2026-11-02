export const SHOP_STAFF_ROLES = ["cashier", "admin", "manager"] as const;
export type AssignedStaffRole = (typeof SHOP_STAFF_ROLES)[number];
export type ShopStaffRole = "owner" | AssignedStaffRole;

export const SELF_SERVE_SHOP_LIMIT = 12;

const CASHIER_HREFS = new Set([
  "/shop",
  "/shop/pos",
  "/shop/sales",
  "/shop/orders",
  "/shop/receipts",
  "/shop/notifications",
  "/shop/help",
]);

const MANAGER_BLOCKED = new Set(["/shop/subscription", "/shop/settings", "/shop/employees"]);

export function staffCanManage(role: ShopStaffRole | null | undefined) {
  return role === "owner" || role === "admin" || role === "manager";
}

export function staffIsOwner(role: ShopStaffRole | null | undefined) {
  return role === "owner";
}

export function staffPathAllowed(role: ShopStaffRole | null | undefined, pathname: string) {
  if (!role || role === "owner" || role === "admin") return true;
  if (role === "manager") {
    return ![...MANAGER_BLOCKED].some((href) => pathname === href || pathname.startsWith(`${href}/`));
  }
  if (pathname === "/shop") return true;
  for (const href of CASHIER_HREFS) {
    if (href !== "/shop" && (pathname === href || pathname.startsWith(`${href}/`))) return true;
  }
  if (pathname.startsWith("/shop/service-requests/")) return true;
  return false;
}

export function staffHome(role: ShopStaffRole | null | undefined) {
  return role === "cashier" ? "/shop/pos" : "/shop";
}

export function staffRoleLabel(role: ShopStaffRole | null | undefined) {
  if (role === "cashier") return "Cashier";
  if (role === "admin") return "Shop admin";
  if (role === "manager") return "Manager";
  return "Shop owner";
}
