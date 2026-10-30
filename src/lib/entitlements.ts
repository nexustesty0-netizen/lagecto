import { createServerSupabase } from "@/lib/supabase/server";
import {
  featuresForPackage,
  isPaidPackage,
  normalizeDurationKey,
  normalizePackageKey,
  type DurationKey,
  type PackageKey,
} from "@/lib/packages";
import { getOwnedShop } from "@/lib/auth/session";

export type ShopSubscriptionState = {
  packageKey: PackageKey;
  durationKey: DurationKey | null;
  status: "free" | "active" | "trial" | "expired";
  paymentStatus: string | null;
  startDate: string | null;
  endDate: string | null;
  verified: boolean;
  planName: string | null;
  amount: number | null;
};

function isCurrent(endDate?: string | null) {
  if (!endDate) return false;
  const end = new Date(`${endDate}T23:59:59`);
  return !Number.isNaN(end.getTime()) && end.getTime() >= Date.now();
}

export async function expireDueSubscriptions(shopId?: string | null) {
  const supabase = await createServerSupabase();
  try {
    await supabase.rpc("expire_due_subscriptions", { p_shop_id: shopId || null });
  } catch {
    // Applied with supabase/migrations/20260909020000_shop_packages.sql
  }
}

export async function getShopSubscription(shopId: string | null | undefined): Promise<ShopSubscriptionState> {
  const empty: ShopSubscriptionState = {
    packageKey: "free",
    durationKey: null,
    status: "free",
    paymentStatus: null,
    startDate: null,
    endDate: null,
    verified: false,
    planName: null,
    amount: null,
  };
  if (!shopId) return empty;
  await expireDueSubscriptions(shopId);
  const supabase = await createServerSupabase();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub) return empty;
  const packageKey = normalizePackageKey(sub.package_key || sub.plan);
  const current = (sub.status === "active" || sub.status === "trial") && isCurrent(sub.renewal_date);
  const paid = isPaidPackage(packageKey) && current;
  return {
    packageKey: paid ? packageKey : "free",
    durationKey: paid ? normalizeDurationKey(sub.duration_key, sub.duration_months) : null,
    status: paid ? (sub.status as "active" | "trial") : sub.status === "expired" || sub.renewal_date ? "expired" : "free",
    paymentStatus: sub.payment_status || null,
    startDate: sub.start_date || null,
    endDate: sub.renewal_date || null,
    verified: current,
    planName: sub.plan || null,
    amount: sub.amount != null ? Number(sub.amount) : null,
  };
}

export type ShopFeatureState = {
  features: Set<string>;
  disabled: string[];
  packageKey: PackageKey;
};

export async function getShopFeatureState(shopId: string | null | undefined): Promise<ShopFeatureState> {
  const sub = await getShopSubscription(shopId);
  const fallback: ShopFeatureState = {
    features: featuresForPackage(sub.packageKey),
    disabled: [],
    packageKey: sub.packageKey,
  };
  if (!shopId) return fallback;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("shop_enabled_features", { p_shop_id: shopId });
  if (error || !data || typeof data !== "object") return fallback;
  const row = data as { ok?: boolean; features?: unknown; disabled?: unknown; package_key?: string };
  if (row.ok === false) return fallback;
  const list = Array.isArray(row.features) ? row.features.map(String) : [...featuresForPackage(sub.packageKey)];
  return {
    features: new Set(list),
    disabled: Array.isArray(row.disabled) ? row.disabled.map(String) : [],
    packageKey: normalizePackageKey(row.package_key || sub.packageKey),
  };
}

export async function getShopFeatures(shopId: string | null | undefined): Promise<Set<string>> {
  const state = await getShopFeatureState(shopId);
  return state.features;
}

export function featureLockReason(features: Set<string>, disabled: string[] | undefined, key: string): "package" | "admin" | null {
  if (features.has(key)) return null;
  return disabled?.includes(key) ? "admin" : "package";
}

export async function loadOwnedShopWithFeatures() {
  const { profile, shop } = await getOwnedShop();
  const [featureState, subscription] = await Promise.all([getShopFeatureState(shop?.id), getShopSubscription(shop?.id)]);
  return {
    profile,
    shop,
    features: featureState.features,
    disabledFeatures: featureState.disabled,
    subscription,
  };
}

export async function getCurrentPeriod(shopId: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("financial_periods")
    .select("*")
    .eq("shop_id", shopId)
    .eq("is_current", true)
    .maybeSingle();
  return data;
}

export function isVerifiedFromStatus(status?: string | null) {
  return status === "verified";
}
