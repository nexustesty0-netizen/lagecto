import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { productImage, type PublicShop } from "@/lib/public-catalog";
import { withComputedOpen } from "@/lib/hours";
import { loadEffectivePrices } from "@/lib/pricing";

const SHOP_CARD_COLUMNS =
  "id, name, slug, category, address, avg_rating, total_reviews, is_open, auto_close, opening_hours, logo_url, banner_url, verification_status, about";

export function toPublicShop(shop: {
  id: string;
  name: string;
  slug?: string | null;
  category?: string | null;
  address?: string | null;
  avg_rating?: number | null;
  total_reviews?: number | null;
  is_open?: boolean | null;
  logo_url?: string | null;
  banner_url?: string | null;
  verification_status?: string | null;
  about?: string | null;
}): PublicShop {
  return {
    id: shop.id,
    name: shop.name,
    slug: shop.slug || null,
    category: shop.category || "other",
    address: shop.address || null,
    avgRating: Number(shop.avg_rating || 0),
    totalReviews: Number(shop.total_reviews || 0),
    isOpen: Boolean(shop.is_open),
    logoUrl: shop.logo_url || null,
    bannerUrl: shop.banner_url || null,
    verificationStatus: shop.verification_status || "",
    about: shop.about || null,
  };
}

export type PricedProduct = {
  id: string;
  shopId: string;
  shopName: string;
  shopSlug: string | null;
  name: string;
  listPrice: number;
  unitPrice: number;
  image: string;
  category: string;
  type: "product" | "service";
  isPopular: boolean;
  onSale: boolean;
  stock: number | null;
  description: string | null;
  availability?: "available" | "on_order" | null;
};

function asShop(value: unknown): { id: string; name: string; slug?: string | null } | null {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as { id: string; name: string }) ?? null;
  return value as { id: string; name: string; slug?: string | null };
}

async function mapProducts(rows: Record<string, unknown>[]) {
  const supabase = await createServerSupabase();
  const ids = rows.map((row) => row.id as string);
  const prices = await loadEffectivePrices((args) => supabase.rpc("product_prices_for_ids", args), ids);

  return rows.map((row) => {
    const shop = asShop(row.shops);
    const priced = prices.get(row.id as string);
    const list = priced?.listPrice ?? Number(row.price || 0);
    const unit = priced?.unitPrice ?? list;
    return {
      id: row.id as string,
      shopId: (row.shop_id as string) || shop?.id || "",
      shopName: shop?.name || "Shop",
      shopSlug: shop?.slug || null,
      name: row.name as string,
      listPrice: list,
      unitPrice: unit,
      image: productImage(row.image as string | null, row.category as string | null),
      category: String(row.category || "other").toLowerCase(),
      type: (row.type as "product" | "service") || "product",
      isPopular: Boolean(row.is_popular),
      onSale: Boolean(priced?.onSale),
      stock: row.stock == null ? null : Number(row.stock),
      description: (row.description as string) || null,
      availability: row.availability === "on_order" ? "on_order" : "available",
    } satisfies PricedProduct;
  });
}

export async function getProductsByIds(ids: string[]) {
  if (!ids.length || !isSupabaseConfigured()) return [];
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("products")
    .select("id, name, price, image, category, type, is_popular, stock, description, availability, shop_id, shops!inner(id, name, slug, status)")
    .in("id", ids)
    .eq("is_available", true)
    .eq("shops.status", "active");
  const mapped = await mapProducts((data || []) as Record<string, unknown>[]);
  const order = new Map(ids.map((id, index) => [id, index]));
  return mapped.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
}

export async function getTrendingProducts(limit = 8) {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("marketplace_trending_products", { p_limit: limit });
  if (error || !data?.length) return [];
  return getProductsByIds(data.map((row: { product_id: string }) => row.product_id));
}

export async function getMostSoldProducts(limit = 8) {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("marketplace_most_sold_products", { p_limit: limit });
  if (error || !data?.length) return [];
  return getProductsByIds(data.map((row: { product_id: string }) => row.product_id));
}

export async function getLatestProducts(limit = 8) {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("products")
    .select("id, name, price, image, category, type, is_popular, stock, description, availability, shop_id, shops!inner(id, name, slug, status)")
    .eq("is_available", true)
    .eq("shops.status", "active")
    .order("created_at", { ascending: false })
    .limit(limit);
  return mapProducts((data || []) as Record<string, unknown>[]);
}

export async function getTopShops(limit = 6) {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("marketplace_top_shops", { p_limit: limit });
  if (error || !data?.length) return [];
  const ids = data.map((row: { shop_id: string }) => row.shop_id);
  const { data: shops } = await supabase
    .from("shops")
    .select(SHOP_CARD_COLUMNS)
    .in("id", ids)
    .eq("status", "active");
  const order = new Map(ids.map((id: string, index: number) => [String(id), index]));
  const rank = (id: unknown) => Number(order.get(String(id)) ?? 99);
  return (shops || []).map(withComputedOpen).slice().sort((a, b) => rank(a.id) - rank(b.id));
}

export async function getLatestShops(limit = 4) {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("shops")
    .select(SHOP_CARD_COLUMNS)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data || []).map(withComputedOpen);
}

export async function getTrendingShops(limit = 6) {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("marketplace_trending_shops", { p_limit: limit });
  if (error || !data?.length) return [];
  const ids = data.map((row: { shop_id: string }) => row.shop_id);
  const { data: shops } = await supabase
    .from("shops")
    .select(SHOP_CARD_COLUMNS)
    .in("id", ids)
    .eq("status", "active");
  const order = new Map(ids.map((id: string, index: number) => [String(id), index]));
  const rank = (id: unknown) => Number(order.get(String(id)) ?? 99);
  return (shops || []).map(withComputedOpen).slice().sort((a, b) => rank(a.id) - rank(b.id));
}

export async function getLiveAds(limit = 6) {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("live_marketplace_ads", { p_limit: limit });
  return data || [];
}

export async function getLivePromotions(limit = 8) {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("promotions")
    .select("id, shop_id, title, discount, image, product_id, promo_price, original_price, expiry_date, starts_at, ends_at, is_active, shops!inner(id, name, slug, status)")
    .eq("is_active", true)
    .eq("shops.status", "active")
    .order("created_at", { ascending: false })
    .limit(limit * 2);
  const now = Date.now();
  return (data || []).filter((row) => {
    const start = row.starts_at ? new Date(row.starts_at).getTime() : 0;
    const end = row.ends_at ? new Date(row.ends_at).getTime() : row.expiry_date ? new Date(`${row.expiry_date}T23:59:59`).getTime() : Infinity;
    return start <= now && now <= end;
  }).slice(0, limit);
}

export async function getRecommendations(options: {
  userId?: string | null;
  productId?: string | null;
  shopId?: string | null;
  limit?: number;
}) {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("marketplace_recommendations", {
    p_user_id: options.userId || null,
    p_product_id: options.productId || null,
    p_shop_id: options.shopId || null,
    p_limit: options.limit || 8,
  });
  if (error || !data?.length) {
    if (options.shopId) return searchCatalog({ shopId: options.shopId, limit: options.limit || 8 });
    return getTrendingProducts(options.limit || 8);
  }
  let products = await getProductsByIds(data.map((row: { product_id: string }) => row.product_id));
  if (options.shopId) {
    products = products.filter((item) => item.shopId === options.shopId);
    if (!products.length) return searchCatalog({ shopId: options.shopId, limit: options.limit || 8 });
  }
  return products;
}

export type CatalogSort = "relevance" | "newest" | "price_asc" | "price_desc" | "popular";

export async function searchCatalog(options: {
  q?: string;
  category?: string;
  type?: "product" | "service" | "all";
  shopId?: string;
  minPrice?: number;
  maxPrice?: number;
  onSale?: boolean;
  available?: boolean;
  sort?: CatalogSort;
  limit?: number;
}) {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerSupabase();
  let query = supabase
    .from("products")
    .select("id, name, price, image, category, type, is_popular, stock, description, availability, created_at, shop_id, shops!inner(id, name, slug, status)")
    .eq("is_available", true)
    .eq("shops.status", "active");

  const q = String(options.q || "")
    .replace(/[%_,()]/g, " ")
    .trim()
    .slice(0, 80);
  if (q) query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
  if (options.category && options.category !== "all") query = query.ilike("category", options.category);
  if (options.type && options.type !== "all") query = query.eq("type", options.type);
  if (options.shopId) query = query.eq("shop_id", options.shopId);
  if (options.minPrice != null) query = query.gte("price", options.minPrice);
  if (options.maxPrice != null) query = query.lte("price", options.maxPrice);
  if (options.available) query = query.gt("stock", 0);

  if (options.sort === "newest") query = query.order("created_at", { ascending: false });
  else if (options.sort === "price_asc") query = query.order("price", { ascending: true });
  else if (options.sort === "price_desc") query = query.order("price", { ascending: false });
  else query = query.order("is_popular", { ascending: false }).order("created_at", { ascending: false });

  query = query.limit(options.limit || 48);
  const { data } = await query;
  let mapped = await mapProducts((data || []) as Record<string, unknown>[]);
  if (options.onSale) mapped = mapped.filter((item) => item.onSale);
  return mapped;
}
