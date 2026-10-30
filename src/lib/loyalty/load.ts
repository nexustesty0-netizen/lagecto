import { createServerSupabase } from "@/lib/supabase/server";

export type LoyaltyLevel = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  rank: number;
  min_points: number;
  discount_percent: number;
  benefits: unknown;
};

export type BadgeDef = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  audience: string;
  category: string;
  rarity: string;
  icon: string;
  requirements: { all?: { metric: string; gte?: number; eq?: boolean }[] };
  is_visible: boolean;
  sort_order: number;
};

export type PublicShopBadge = { slug: string; name: string; icon: string; rarity: string };

export function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

export async function evaluateCurrentCustomer() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("evaluate_customer_engagement");
  return data as { ok?: boolean; snapshot?: Record<string, unknown>; newly_unlocked?: { id: string; slug: string; name: string; description: string; rarity: string; icon: string }[] } | null;
}

export async function loadCustomerLoyalty(userId: string) {
  const supabase = await createServerSupabase();
  const [{ data: platformWallet }, { data: shopWallets }, { data: platformProgram }] = await Promise.all([
    supabase
      .from("loyalty_wallets")
      .select("id, points, lifetime_points, level_id, loyalty_levels(id, slug, name, description, icon, rank, min_points, discount_percent, benefits)")
      .eq("user_id", userId)
      .eq("scope", "platform")
      .maybeSingle(),
    supabase
      .from("loyalty_wallets")
      .select("id, points, lifetime_points, shop_id, shops(name, slug), loyalty_levels(name, rank, min_points)")
      .eq("user_id", userId)
      .eq("scope", "shop")
      .order("lifetime_points", { ascending: false })
      .limit(12),
    supabase.from("loyalty_programs").select("id").eq("scope", "platform").maybeSingle(),
  ]);

  const programId = platformProgram?.id;
  const { data: levels } = programId
    ? await supabase.from("loyalty_levels").select("*").eq("program_id", programId).eq("is_active", true).order("rank")
    : { data: [] as LoyaltyLevel[] };

  const { data: transactions } = platformWallet?.id
    ? await supabase
        .from("loyalty_transactions")
        .select("id, points, reason, kind, created_at")
        .eq("wallet_id", platformWallet.id)
        .order("created_at", { ascending: false })
        .limit(12)
    : { data: [] };

  return {
    platformWallet,
    shopWallets: shopWallets || [],
    levels: (levels || []) as LoyaltyLevel[],
    transactions: transactions || [],
  };
}

export async function loadCustomerBadges(userId: string) {
  const supabase = await createServerSupabase();
  const [{ data: defs }, { data: earned }, { data: progress }] = await Promise.all([
    supabase
      .from("customer_badge_definitions")
      .select("id, slug, name, description, audience, category, rarity, icon, requirements, is_visible, sort_order")
      .eq("audience", "customer")
      .eq("is_active", true)
      .order("sort_order"),
    supabase.from("customer_badges").select("badge_id, earned_at").eq("user_id", userId),
    supabase.from("badge_progress").select("badge_id, current_value, target_value").eq("user_id", userId),
  ]);
  return {
    defs: (defs || []) as BadgeDef[],
    earned: earned || [],
    progress: progress || [],
  };
}

export async function loadCustomerRewards(userId: string) {
  const supabase = await createServerSupabase();
  const now = new Date().toISOString();
  const [{ data: rewards }, { data: claims }, { data: codes }] = await Promise.all([
    supabase
      .from("rewards")
      .select("*")
      .eq("is_active", true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("reward_claims")
      .select("id, status, created_at, used_at, reward_id, promo_code_id, rewards(name, reward_type, value), promo_codes(code, ends_at)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("promo_redemptions")
      .select("id, discount_amount, created_at, status, promo_codes(code, name)")
      .eq("user_id", userId)
      .eq("status", "applied")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  return { rewards: rewards || [], claims: claims || [], redemptions: codes || [] };
}

export async function loadPublicPromotions(userId?: string | null) {
  const supabase = await createServerSupabase();
  const now = new Date().toISOString();
  const [{ data: codes }, { data: shopPromos }] = await Promise.all([
    supabase
      .from("promo_codes")
      .select("id, code, name, description, discount_type, percent_off, amount_off, min_order_amount, ends_at, shop_id, owner_scope, loyalty_only, customer_segment, shops(name, slug)")
      .eq("is_active", true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("promotions")
      .select("id, title, discount, promo_price, ends_at, expiry_date, shop_id, shops(name, slug)")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(24),
  ]);
  void userId;
  const liveShopPromos = (shopPromos || []).filter((row) => {
    const end = row.ends_at || row.expiry_date;
    return !end || end >= now;
  });
  const horizonMs = new Date(now).getTime() + 1000 * 60 * 60 * 48;
  const expiringSoon = (codes || []).filter((row) => row.ends_at && new Date(row.ends_at).getTime() < horizonMs);
  return { codes: codes || [], shopPromos: liveShopPromos, expiringSoon };
}

export async function loadShopBadgesMap(shopIds: string[]) {
  const map = new Map<string, PublicShopBadge[]>();
  if (!shopIds.length) return map;
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("shop_badges")
    .select("shop_id, customer_badge_definitions(slug, name, icon, rarity)")
    .in("shop_id", shopIds);
  for (const row of data || []) {
    const def = row.customer_badge_definitions as unknown as PublicShopBadge | PublicShopBadge[] | null;
    const item = Array.isArray(def) ? def[0] : def;
    if (!item?.slug) continue;
    if (!["verified_shop", "customer_favourite", "top_seller", "founding_shop", "trusted_shop", "excellent_rating", "marketplace_leader"].includes(item.slug)) {
      continue;
    }
    const list = map.get(row.shop_id) || [];
    if (list.length < 3) list.push(item);
    map.set(row.shop_id, list);
  }
  return map;
}

export const BADGE_CATEGORIES = [
  { slug: "getting_started", label: "Getting started" },
  { slug: "shopping", label: "Shopping" },
  { slug: "reviews", label: "Reviews & community" },
  { slug: "discovery", label: "Discovery" },
  { slug: "loyalty", label: "Loyalty" },
  { slug: "challenges", label: "Challenges" },
  { slug: "consistency", label: "Consistency" },
  { slug: "supporting", label: "Supporting businesses" },
  { slug: "promotions", label: "Promotions" },
  { slug: "advanced", label: "Advanced" },
  { slug: "special", label: "Special" },
] as const;

export function rarityClass(rarity: string) {
  if (rarity === "legendary") return "ring-[#D4AF37]/70 bg-[linear-gradient(180deg,#fffdf8,#f7efd6)]";
  if (rarity === "epic") return "ring-[#0B6E4F]/35 bg-[linear-gradient(180deg,#fffdf8,#e7f3ee)]";
  if (rarity === "rare") return "ring-[#2E8B57]/30";
  if (rarity === "uncommon") return "ring-[#0B6E4F]/15";
  return "ring-[var(--lagecto-border)]";
}
