import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types";

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

export async function getOwnedShop() {
  const profile = await requireRole("shop_owner");
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("shops")
    .select("*")
    .or(`owner_user_id.eq.${profile.id},owner_email.eq.${profile.email}`)
    .limit(1)
    .maybeSingle();
  return { profile, shop: data };
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

export async function requireApiShop() {
  const auth = await requireApiProfile("shop_owner");
  if (!auth.ok) return auth;
  const supabase = await createServerSupabase();
  const { data: shop } = await supabase
    .from("shops")
    .select("*")
    .or(`owner_user_id.eq.${auth.profile.id},owner_email.eq.${auth.profile.email}`)
    .limit(1)
    .maybeSingle();
  if (!shop) {
    return { ok: false as const, error: NextResponse.json({ error: "No shop assigned to this account." }, { status: 403 }) };
  }
  return { ok: true as const, profile: auth.profile, shop };
}

export async function requireApiShopFeature(feature: string) {
  const { getShopFeatures } = await import("@/lib/entitlements");
  const auth = await requireApiShop();
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
