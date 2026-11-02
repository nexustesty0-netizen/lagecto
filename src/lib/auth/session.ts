import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Profile, Shop, UserRole } from "@/lib/types";
import { hasAdminLevel, type AdminRole } from "@/lib/admin-access";
import { staffCanManage, staffIsOwner, type ShopStaffRole } from "@/lib/shop/staff";

export async function getSessionUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getProfile(): Promise<Profile | null> {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from("users")
      .select(
        "id, email, name, phone, username, username_normalized, last_username_change_at, role, admin_role, account_status, avatar_url, address, last_login_at, created_at",
      )
      .eq("id", user.id)
      .maybeSingle();

    return (data as Profile | null) ?? null;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.account_status !== "active") {
    redirect("/login?locked=1");
  }
  return profile;
}

export async function requireRole(roles: UserRole | UserRole[]) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  const profile = await requireUser();
  if (!allowed.includes(profile.role)) {
    redirect("/403");
  }
  return profile;
}

export async function requireAdminLevel(min: AdminRole) {
  const profile = await requireRole("admin");
  if (!hasAdminLevel(profile, min)) redirect("/403");
  return profile;
}

export async function loadShopForProfile(profile: Profile) {
  const supabase = await createServerSupabase();
  if (profile.role === "shop_owner") {
    const { data } = await supabase
      .from("shops")
      .select("*")
      .or(`owner_user_id.eq.${profile.id},owner_email.eq.${profile.email}`)
      .limit(1)
      .maybeSingle();
    return { profile, shop: (data as Shop | null) ?? null, staffRole: "owner" as ShopStaffRole };
  }
  const { data: assignment } = await supabase
    .from("shop_staff_assignments")
    .select("shop_id, role_name")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!assignment?.shop_id) {
    return { profile, shop: null as Shop | null, staffRole: null as ShopStaffRole | null };
  }
  const { data: shop } = await supabase.from("shops").select("*").eq("id", assignment.shop_id).maybeSingle();
  const role = assignment.role_name === "admin" || assignment.role_name === "manager" || assignment.role_name === "cashier"
    ? (assignment.role_name as ShopStaffRole)
    : "cashier";
  return { profile, shop: (shop as Shop | null) ?? null, staffRole: shop ? role : null };
}

export async function getOwnedShop() {
  const profile = await requireUser();
  const packed = await loadShopForProfile(profile);
  if (profile.role === "shop_owner") return packed;
  if (!packed.shop || !packed.staffRole) redirect("/403");
  return packed;
}

export async function requireApiProfile(roles?: UserRole | UserRole[]) {
  const profile = await getProfile();
  if (!profile) {
    return { ok: false as const, error: NextResponse.json({ error: "Please log in." }, { status: 401 }) };
  }
  if (profile.account_status !== "active") {
    return { ok: false as const, error: NextResponse.json({ error: "This account is locked." }, { status: 403 }) };
  }
  if (roles) {
    const allowed = Array.isArray(roles) ? roles : [roles];
    if (!allowed.includes(profile.role)) {
      return { ok: false as const, error: NextResponse.json({ error: "You don't have permission." }, { status: 403 }) };
    }
  }
  return { ok: true as const, profile };
}

export async function requireApiAdminLevel(min: AdminRole) {
  const auth = await requireApiProfile("admin");
  if (!auth.ok) return auth;
  if (!hasAdminLevel(auth.profile, min)) {
    return { ok: false as const, error: NextResponse.json({ error: "You don't have permission." }, { status: 403 }) };
  }
  return auth;
}

export async function requireApiShop() {
  const auth = await requireApiProfile();
  if (!auth.ok) return auth;
  const packed = await loadShopForProfile(auth.profile);
  if (!packed.shop || !packed.staffRole) {
    return { ok: false as const, error: NextResponse.json({ error: "No shop assigned to this account." }, { status: 403 }) };
  }
  return { ok: true as const, profile: packed.profile, shop: packed.shop, staffRole: packed.staffRole };
}

export async function requireApiShopManage() {
  const auth = await requireApiShop();
  if (!auth.ok) return auth;
  if (!staffCanManage(auth.staffRole)) {
    return { ok: false as const, error: NextResponse.json({ error: "Cashiers cannot do this." }, { status: 403 }) };
  }
  return auth;
}

export async function requireApiShopOwner() {
  const auth = await requireApiShop();
  if (!auth.ok) return auth;
  if (!staffIsOwner(auth.staffRole)) {
    return { ok: false as const, error: NextResponse.json({ error: "Only the shop owner can do this." }, { status: 403 }) };
  }
  return auth;
}

export async function requireApiShopFeature(feature: string) {
  const { getShopFeatures } = await import("@/lib/entitlements");
  const auth = await requireApiShopManage();
  if (!auth.ok) return auth;
  const features = await getShopFeatures(auth.shop.id);
  if (!features.has(feature)) {
    return {
      ok: false as const,
      error: NextResponse.json({ error: "This feature is not available for your shop." }, { status: 403 }),
    };
  }
  return { ...auth, features };
}
