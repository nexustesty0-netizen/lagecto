import { createServerSupabase } from "@/lib/supabase/server";
import type { DashboardPeriod } from "@/lib/shop/dashboard-stats";

export type MarketplacePlatformStats = {
  ok: boolean;
  timezone: string;
  period: string;
  users_total: number;
  users_new: number;
  shops_total: number;
  shops_active: number;
  shops_verified: number;
  shops_new: number;
  products: number;
  services: number;
  orders_count: number;
  marketplace_events: number;
  active_promotions: number;
  live_ads: number;
  active_subscriptions: number;
  package_bookings_amount: number;
  platform_pos_count: number;
  platform_pos_amount: number;
  pending_verification: number;
  pending_registrations: number;
  locked_accounts: number;
  published_news: number;
  note?: string;
};

export type PerformingShop = {
  shop_id: string;
  shop_name: string;
  logo_url: string | null;
  verification_status: string;
  score: number;
  paid_orders: number;
  unique_customers: number;
  engagement_events: number;
  avg_rating: number;
  total_reviews: number;
};

function asStats(value: unknown): MarketplacePlatformStats | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.ok === false) return null;
  return {
    ok: true,
    timezone: String(row.timezone || "Africa/Harare"),
    period: String(row.period || "week"),
    users_total: Number(row.users_total || 0),
    users_new: Number(row.users_new || 0),
    shops_total: Number(row.shops_total || 0),
    shops_active: Number(row.shops_active || 0),
    shops_verified: Number(row.shops_verified || 0),
    shops_new: Number(row.shops_new || 0),
    products: Number(row.products || 0),
    services: Number(row.services || 0),
    orders_count: Number(row.orders_count || 0),
    marketplace_events: Number(row.marketplace_events || 0),
    active_promotions: Number(row.active_promotions || 0),
    live_ads: Number(row.live_ads || 0),
    active_subscriptions: Number(row.active_subscriptions || 0),
    package_bookings_amount: Number(row.package_bookings_amount || 0),
    platform_pos_count: Number(row.platform_pos_count || 0),
    platform_pos_amount: Number(row.platform_pos_amount || 0),
    pending_verification: Number(row.pending_verification || 0),
    pending_registrations: Number(row.pending_registrations || 0),
    locked_accounts: Number(row.locked_accounts || 0),
    published_news: Number(row.published_news || 0),
    note: row.note ? String(row.note) : undefined,
  };
}

/** Platform metrics. Shop GMV is never included. */
export async function getMarketplaceAnalytics(options?: { period?: DashboardPeriod | string; from?: string; to?: string }) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("marketplace_platform_stats", {
    p_period: options?.period || "week",
    p_from: options?.from || null,
    p_to: options?.to || null,
  });
  if (error) return null;
  return asStats(data);
}

export async function getRecentSecurityEventCount(days = 7) {
  const supabase = await createServerSupabase();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { count } = await supabase.from("security_events").select("*", { count: "exact", head: true }).gte("created_at", since);
  return count || 0;
}

export async function getTopPerformingShops(limit = 3, period = "month") {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("marketplace_performing_shops", {
    p_limit: limit,
    p_period: period,
  });
  if (error || !Array.isArray(data)) return [];
  return data.map((row: Record<string, unknown>) => ({
    shop_id: String(row.shop_id),
    shop_name: String(row.shop_name || "Shop"),
    logo_url: (row.logo_url as string) || null,
    verification_status: String(row.verification_status || "unverified"),
    score: Number(row.score || 0),
    paid_orders: Number(row.paid_orders || 0),
    unique_customers: Number(row.unique_customers || 0),
    engagement_events: Number(row.engagement_events || 0),
    avg_rating: Number(row.avg_rating || 0),
    total_reviews: Number(row.total_reviews || 0),
  })) satisfies PerformingShop[];
}

export const TOP_SHOPS_FORMULA =
  "Score = paid orders (period) × 4 + unique customers × 3 + marketplace events × 1 + min(reviews, 40) × rating × 0.35 + verified bonus 8 + recent activity bonus 2. Shop revenue is not used.";
