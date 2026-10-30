import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { productImage } from "@/lib/public-catalog";
import { resolveStorefrontTheme, type StorefrontColors } from "@/lib/storefront/theme";
import { getShopSubscription } from "@/lib/entitlements";
import { shopIsOpenNow } from "@/lib/hours";

export type StorefrontShop = {
  id: string;
  name: string;
  slug: string;
  category: string;
  provider_type: "products" | "services" | "both";
  address: string | null;
  phone: string | null;
  email: string | null;
  about: string | null;
  mission: string | null;
  vision: string | null;
  aim: string | null;
  core_values: string | null;
  service_delivery: string | null;
  website_url: string | null;
  youtube_url: string | null;
  logo_url: string | null;
  banner_url: string | null;
  is_open: boolean;
  auto_close?: boolean | null;
  opening_hours: unknown;
  is_pickup_only: boolean;
  delivery_time: string | null;
  whatsapp_number: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  twitter_url: string | null;
  tiktok_url: string | null;
  linkedin_url: string | null;
  avg_rating: number;
  total_reviews: number;
  verification_status: string;
  verified: boolean;
  meta_title: string | null;
  meta_description: string | null;
};

export function blogMediaUrl(post: { media_type?: string | null; media_url?: string | null; cover_image?: string | null }) {
  if (post.media_type === "none") return null;
  return post.media_url || post.cover_image || null;
}

export type StorefrontConfig = {
  hero_title: string | null;
  hero_subtitle: string | null;
  tagline: string | null;
  cover_position: string;
  cta_label: string | null;
  is_published: boolean;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  background_color: string | null;
  gallery: unknown;
};

const STOREFRONT_SHOP_COLUMNS =
  "id, name, slug, category, provider_type, address, phone, email, about, mission, vision, logo_url, banner_url, is_open, auto_close, is_pickup_only, delivery_time, whatsapp_number, facebook_url, instagram_url, twitter_url, tiktok_url, linkedin_url, opening_hours, avg_rating, total_reviews, verification_status, meta_title, meta_description, status";
const STOREFRONT_STORY_COLUMNS = ", aim, core_values, service_delivery, website_url, youtube_url";

export async function getStorefrontBySlug(slug: string) {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabase();
  let { data: shop } = await supabase
    .from("shops")
    .select(`${STOREFRONT_SHOP_COLUMNS}${STOREFRONT_STORY_COLUMNS}`)
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (!shop?.slug) {
    const retry = await supabase
      .from("shops")
      .select(STOREFRONT_SHOP_COLUMNS)
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle();
    shop = retry.data as typeof shop;
  }
  if (!shop?.slug) return null;

  const subscription = await getShopSubscription(shop.id);
  const verified = subscription.verified;
  const row = shop as unknown as StorefrontShop;
  const storefrontShop = {
    ...row,
    aim: row.aim ?? null,
    core_values: row.core_values ?? null,
    service_delivery: row.service_delivery ?? null,
    website_url: row.website_url ?? null,
    youtube_url: row.youtube_url ?? null,
    verification_status: verified ? "verified" : "unverified",
    verified,
    is_open: shopIsOpenNow(shop),
  } as StorefrontShop;

  const { data: config } = await supabase.from("shop_storefront_config").select("*").eq("shop_id", shop.id).maybeSingle();
  const theme = resolveStorefrontTheme({
    primary: config?.primary_color,
    secondary: config?.secondary_color,
    accent: config?.accent_color,
    background: config?.background_color,
  } satisfies StorefrontColors);

  return { shop: storefrontShop, config: (config || null) as StorefrontConfig | null, theme };
}

export async function getStorefrontById(id: string) {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabase();
  const { data: shop } = await supabase.from("shops").select("slug, status").eq("id", id).eq("status", "active").maybeSingle();
  if (!shop?.slug) return null;
  return getStorefrontBySlug(shop.slug);
}

export async function getStorefrontCatalog(shopId: string, type?: "product" | "service") {
  const supabase = await createServerSupabase();
  let query = supabase
    .from("products")
    .select("id, name, price, image, category, type, description, duration, stock, is_popular, is_available")
    .eq("shop_id", shopId)
    .eq("is_available", true)
    .order("is_popular", { ascending: false })
    .order("name");
  if (type) query = query.eq("type", type);
  const { data } = await query;
  const rows = data || [];
  const priced = await Promise.all(
    rows.map(async (row) => {
      const { data: price } = await supabase.rpc("product_effective_price", { p_product_id: row.id });
      return {
        ...row,
        image: productImage(row.image, row.category),
        listPrice: Number(row.price || 0),
        unitPrice: Number(price?.unit_price ?? row.price ?? 0),
        onSale: Boolean(price?.on_sale),
      };
    }),
  );
  return priced;
}

export async function getStorefrontProduct(shopId: string, productId: string) {
  const supabase = await createServerSupabase();
  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("shop_id", shopId)
    .eq("id", productId)
    .eq("is_available", true)
    .maybeSingle();
  if (!product) return null;
  const [{ data: images }, { data: price }] = await Promise.all([
    supabase.from("product_images").select("*").eq("product_id", productId).order("sort_order"),
    supabase.rpc("product_effective_price", { p_product_id: productId }),
  ]);
  const gallery = (images || []).map((row) => row.url).filter(Boolean);
  if (product.image && !gallery.includes(product.image)) gallery.unshift(product.image);
  return {
    ...product,
    images: gallery.length ? gallery : [productImage(product.image, product.category)],
    listPrice: Number(product.price || 0),
    unitPrice: Number(price?.unit_price ?? product.price ?? 0),
    onSale: Boolean(price?.on_sale),
  };
}

export async function getStorefrontExtras(shopId: string) {
  const supabase = await createServerSupabase();
  const [{ data: media }, { data: videos }, { data: posts }, { data: promotions }, { data: faqs }, namedReviews] =
    await Promise.all([
      supabase.from("storefront_media").select("*").eq("shop_id", shopId).order("sort_order").limit(12),
      supabase.from("storefront_videos").select("*").eq("shop_id", shopId).eq("is_published", true).order("sort_order").limit(8),
      supabase
        .from("storefront_blog_posts")
        .select("*")
        .eq("shop_id", shopId)
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(3),
      supabase.from("promotions").select("*").eq("shop_id", shopId).eq("is_active", true).order("created_at", { ascending: false }),
      supabase.from("shop_faq_entries").select("*").eq("shop_id", shopId).order("sort_order"),
      supabase.from("ratings").select("id, rating, review, reply, reviewer_name, created_at").eq("shop_id", shopId).eq("is_hidden", false).order("created_at", { ascending: false }).limit(12),
    ]);
  const reviews = namedReviews.data
    ? namedReviews.data
    : namedReviews.error
      ? (
          await supabase
            .from("ratings")
            .select("id, rating, review, reply, created_at")
            .eq("shop_id", shopId)
            .eq("is_hidden", false)
            .order("created_at", { ascending: false })
            .limit(12)
        ).data
      : [];
  const now = Date.now();
  const livePromos = (promotions || [])
    .filter((row) => {
      const start = row.starts_at ? new Date(row.starts_at).getTime() : 0;
      const end = row.ends_at ? new Date(row.ends_at).getTime() : row.expiry_date ? new Date(`${row.expiry_date}T23:59:59`).getTime() : Infinity;
      return start <= now && now <= end;
    })
    .sort((a, b) => Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured)));
  return {
    media: media || [],
    videos: videos || [],
    posts: posts || [],
    promotions: livePromos,
    faqs: faqs || [],
    reviews: reviews || [],
  };
}
