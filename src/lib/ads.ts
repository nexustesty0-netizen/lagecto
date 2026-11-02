import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { hasProductPhoto } from "@/lib/public-catalog";
import { getLiveAds } from "@/lib/marketplace/discovery";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DisplayAd = {
  id: string;
  title: string;
  body: string | null;
  imageUrl: string | null;
  href: string;
  kicker: string;
  shopId?: string | null;
  productId?: string | null;
  promotionId?: string | null;
};

type LiveAd = {
  id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  ad_type: string;
  destination_kind: string;
  destination_id: string | null;
};

type ShopRef = {
  id: string;
  name: string;
  slug: string | null;
  banner_url: string | null;
  logo_url: string | null;
};

function isUuid(value: string) {
  return UUID_RE.test(value);
}

function asShop(value: unknown): ShopRef | null {
  if (!value) return null;
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return null;
  const shop = row as ShopRef;
  return shop.id ? shop : null;
}

function shopHref(shop?: ShopRef | null) {
  return shop?.slug ? `/s/${shop.slug}` : "/shops";
}

export async function getDisplayAds(limit = 4): Promise<DisplayAd[]> {
  const rows = (await getLiveAds(limit)) as LiveAd[];
  if (!rows.length || !isSupabaseConfigured()) return [];

  const shopKeys = rows
    .filter((ad) => ad.destination_kind === "shop" && ad.destination_id)
    .map((ad) => String(ad.destination_id));
  const productIds = rows
    .filter((ad) => ad.destination_kind === "product" && ad.destination_id && isUuid(String(ad.destination_id)))
    .map((ad) => String(ad.destination_id));
  const promoIds = rows
    .filter((ad) => ad.destination_kind === "promotion" && ad.destination_id && isUuid(String(ad.destination_id)))
    .map((ad) => String(ad.destination_id));

  const supabase = await createServerSupabase();
  const shopIds = shopKeys.filter(isUuid);
  const shopSlugs = shopKeys.filter((key) => !isUuid(key));

  const [{ data: shopsById }, { data: shopsBySlug }, { data: products }, { data: promotions }, { data: productImages }] =
    await Promise.all([
      shopIds.length
        ? supabase
            .from("shops")
            .select("id, name, slug, banner_url, logo_url")
            .eq("status", "active")
            .in("id", shopIds)
        : Promise.resolve({ data: [] as ShopRef[] }),
      shopSlugs.length
        ? supabase
            .from("shops")
            .select("id, name, slug, banner_url, logo_url")
            .eq("status", "active")
            .in("slug", shopSlugs)
        : Promise.resolve({ data: [] as ShopRef[] }),
      productIds.length
        ? supabase
            .from("products")
            .select("id, name, image, category, shop_id, shops!inner(id, name, slug, banner_url, logo_url, status)")
            .eq("is_available", true)
            .eq("shops.status", "active")
            .in("id", productIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      promoIds.length
        ? supabase
            .from("promotions")
            .select("id, title, image, shop_id, shops!inner(id, name, slug, banner_url, logo_url, status)")
            .eq("is_active", true)
            .eq("shops.status", "active")
            .in("id", promoIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      productIds.length
        ? supabase.from("product_images").select("product_id, url, sort_order").in("product_id", productIds).order("sort_order")
        : Promise.resolve({ data: [] as { product_id: string; url: string | null }[] }),
    ]);

  const shops = new Map<string, ShopRef>();
  for (const shop of [...(shopsById || []), ...(shopsBySlug || [])] as ShopRef[]) {
    shops.set(shop.id, shop);
    if (shop.slug) shops.set(shop.slug, shop);
  }

  const gallery = new Map<string, string>();
  for (const row of productImages || []) {
    if (row.url && !gallery.has(row.product_id)) gallery.set(row.product_id, row.url);
  }

  const productMap = new Map<
    string,
    { id: string; name: string; image: string | null; shop: ShopRef | null }
  >();
  for (const row of products || []) {
    const item = row as { id: string; name: string; image?: string | null; shops?: unknown };
    productMap.set(item.id, { id: item.id, name: item.name, image: item.image || null, shop: asShop(item.shops) });
  }

  const promoMap = new Map<string, { id: string; title: string; image: string | null; shop: ShopRef | null }>();
  for (const row of promotions || []) {
    const item = row as { id: string; title: string; image?: string | null; shops?: unknown };
    promoMap.set(item.id, { id: item.id, title: item.title, image: item.image || null, shop: asShop(item.shops) });
  }

  return rows.map((ad) => {
    const dest = String(ad.destination_id || "").trim();
    let href = "/marketplace";
    let imageUrl = ad.image_url;
    let kicker = "Promoted";
    let shopId: string | null = null;
    let productId: string | null = null;
    let promotionId: string | null = null;

    if (ad.destination_kind === "shop" && dest) {
      const shop = shops.get(dest) || null;
      href = shopHref(shop);
      shopId = shop?.id || null;
      kicker = shop?.name || "Shop";
      imageUrl = ad.image_url || shop?.banner_url || shop?.logo_url || null;
    } else if (ad.destination_kind === "product" && dest) {
      const product = productMap.get(dest);
      const shop = product?.shop || null;
      href = shop?.slug && product ? `/s/${shop.slug}/p/${product.id}` : "/marketplace";
      shopId = shop?.id || null;
      productId = product?.id || null;
      kicker = product?.name || "Product";
      const photo = gallery.get(dest) || (hasProductPhoto(product?.image) ? product?.image : null);
      imageUrl = ad.image_url || photo || shop?.banner_url || shop?.logo_url || null;
    } else if (ad.destination_kind === "promotion" && dest) {
      const promo = promoMap.get(dest);
      const shop = promo?.shop || null;
      href = shop?.slug ? `/s/${shop.slug}/promotions` : "/marketplace";
      shopId = shop?.id || null;
      promotionId = promo?.id || null;
      kicker = shop?.name || "Offer";
      imageUrl = ad.image_url || promo?.image || shop?.banner_url || null;
    } else if (ad.destination_kind === "category" && dest) {
      href = `/marketplace?category=${encodeURIComponent(dest)}`;
      kicker = "Category";
    }

    return {
      id: ad.id,
      title: ad.title,
      body: ad.body,
      imageUrl,
      href,
      kicker,
      shopId,
      productId,
      promotionId,
    };
  });
}
