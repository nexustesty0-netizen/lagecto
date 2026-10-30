import { createServerSupabase } from "@/lib/supabase/server";
import { SHOP_CATEGORIES, categoryLabel } from "@/lib/brand";
import { isSupabaseConfigured } from "@/lib/env";
import { shopIsOpenNow } from "@/lib/hours";

export const MARKETPLACE_IMAGES = {
  formalShoes: "/marketplace/product-formal-shoes.png",
  electronics: "/marketplace/product-electronics.png",
  groceries: "/marketplace/product-groceries.png",
  fashion: "/marketplace/product-fashion.png",
  home: "/marketplace/product-home.png",
  farming: "/marketplace/product-farming.png",
  beauty: "/marketplace/product-beauty.png",
  health: "/marketplace/product-health.png",
  supportHero: "/marketplace/support-hero.png",
  shopsHero: "/marketplace/shops-hero.png",
  plansHero: "/visuals/plans-hero.jpg",
} as const;

export const MARKETPLACE_CATEGORIES = [
  { slug: "all", label: "All" },
  ...SHOP_CATEGORIES,
] as const;

const CATEGORY_IMAGES: Record<string, string> = {
  electronics: MARKETPLACE_IMAGES.electronics,
  phones: MARKETPLACE_IMAGES.electronics,
  computers: MARKETPLACE_IMAGES.electronics,
  hardware: MARKETPLACE_IMAGES.electronics,
  software: MARKETPLACE_IMAGES.electronics,
  fashion: MARKETPLACE_IMAGES.fashion,
  grocery: MARKETPLACE_IMAGES.groceries,
  food: MARKETPLACE_IMAGES.groceries,
  restaurant: MARKETPLACE_IMAGES.groceries,
  bakery: MARKETPLACE_IMAGES.groceries,
  butchery: MARKETPLACE_IMAGES.groceries,
  farming: MARKETPLACE_IMAGES.farming,
  gardening: MARKETPLACE_IMAGES.farming,
  home: MARKETPLACE_IMAGES.home,
  furniture: MARKETPLACE_IMAGES.home,
  construction: MARKETPLACE_IMAGES.home,
  plumbing: MARKETPLACE_IMAGES.home,
  electrical: MARKETPLACE_IMAGES.home,
  beauty: MARKETPLACE_IMAGES.beauty,
  salon: MARKETPLACE_IMAGES.beauty,
  spa: MARKETPLACE_IMAGES.beauty,
  health: MARKETPLACE_IMAGES.health,
  pharmacy: MARKETPLACE_IMAGES.health,
  fitness: MARKETPLACE_IMAGES.health,
  photography: MARKETPLACE_IMAGES.home,
  videography: MARKETPLACE_IMAGES.electronics,
  graphic_design: MARKETPLACE_IMAGES.fashion,
  services: MARKETPLACE_IMAGES.shopsHero,
  other: MARKETPLACE_IMAGES.home,
};

export type PublicProduct = {
  id: string;
  shopId: string | null;
  shopSlug?: string | null;
  shopName: string;
  name: string;
  price: number;
  image: string;
  category: string;
  type: "product" | "service";
  isPopular: boolean;
  isShowcase: boolean;
};

export type PublicShop = {
  id: string;
  name: string;
  slug: string | null;
  category: string;
  address: string | null;
  avgRating: number;
  totalReviews: number;
  isOpen: boolean;
  logoUrl: string | null;
  bannerUrl: string | null;
  verificationStatus: string;
  about: string | null;
  badges?: { slug: string; name: string; icon?: string; rarity?: string }[];
};

export function groupShopsByCategory(shops: PublicShop[]) {
  const buckets = new Map<string, PublicShop[]>();
  for (const shop of shops) {
    const slug = String(shop.category || "other").toLowerCase();
    const list = buckets.get(slug) || [];
    list.push(shop);
    buckets.set(slug, list);
  }
  const seen = new Set<string>();
  const groups: { slug: string; label: string; shops: PublicShop[] }[] = [];
  for (const category of SHOP_CATEGORIES) {
    const list = buckets.get(category.slug);
    if (!list?.length) continue;
    groups.push({ slug: category.slug, label: category.label, shops: list });
    seen.add(category.slug);
  }
  for (const [slug, list] of buckets) {
    if (seen.has(slug) || !list.length) continue;
    groups.push({ slug, label: categoryLabel(slug), shops: list });
  }
  return groups;
}

export type PublicFaq = {
  id: string;
  section: string;
  question: string;
  answer: string;
};

export const SHOWCASE_PRODUCTS: PublicProduct[] = [
  {
    id: "showcase-shoes",
    shopId: null,
    shopName: "LaGecto picks",
    name: "Men's Formal Shoes",
    price: 45,
    image: MARKETPLACE_IMAGES.formalShoes,
    category: "fashion",
    type: "product",
    isPopular: true,
    isShowcase: true,
  },
  {
    id: "showcase-electronics",
    shopId: null,
    shopName: "LaGecto picks",
    name: "Phones & audio",
    price: 89,
    image: MARKETPLACE_IMAGES.electronics,
    category: "electronics",
    type: "product",
    isPopular: true,
    isShowcase: true,
  },
  {
    id: "showcase-groceries",
    shopId: null,
    shopName: "LaGecto picks",
    name: "Fresh groceries",
    price: 12,
    image: MARKETPLACE_IMAGES.groceries,
    category: "grocery",
    type: "product",
    isPopular: true,
    isShowcase: true,
  },
  {
    id: "showcase-fashion",
    shopId: null,
    shopName: "LaGecto picks",
    name: "Everyday fashion",
    price: 28,
    image: MARKETPLACE_IMAGES.fashion,
    category: "fashion",
    type: "product",
    isPopular: true,
    isShowcase: true,
  },
  {
    id: "showcase-home",
    shopId: null,
    shopName: "LaGecto picks",
    name: "Home & kitchen",
    price: 22,
    image: MARKETPLACE_IMAGES.home,
    category: "home",
    type: "product",
    isPopular: true,
    isShowcase: true,
  },
  {
    id: "showcase-farming",
    shopId: null,
    shopName: "LaGecto picks",
    name: "Farming supplies",
    price: 18,
    image: MARKETPLACE_IMAGES.farming,
    category: "farming",
    type: "product",
    isPopular: true,
    isShowcase: true,
  },
  {
    id: "showcase-beauty",
    shopId: null,
    shopName: "LaGecto picks",
    name: "Beauty essentials",
    price: 16,
    image: MARKETPLACE_IMAGES.beauty,
    category: "beauty",
    type: "product",
    isPopular: true,
    isShowcase: true,
  },
  {
    id: "showcase-health",
    shopId: null,
    shopName: "LaGecto picks",
    name: "Health & wellness",
    price: 14,
    image: MARKETPLACE_IMAGES.health,
    category: "health",
    type: "product",
    isPopular: true,
    isShowcase: true,
  },
];

const FALLBACK_FAQS: PublicFaq[] = [
  {
    id: "faq-order",
    section: "ordering",
    question: "How do I place an order?",
    answer: "Browse the marketplace or a shop, add products to your cart, then checkout via WhatsApp. You can order without an account if you add your name. Signed-in customers also get a saved order history. Payment is arranged directly with the shop.",
  },
  {
    id: "faq-pay",
    section: "payments",
    question: "How do payments work?",
    answer: "LaGecto does not collect customer payments. Checkout is via WhatsApp, and payment is arranged directly with the shop. Totals always come from the shop’s product prices.",
  },
  {
    id: "faq-collect",
    section: "delivery",
    question: "Can I pay when I collect?",
    answer: "Yes. Arrange that with the shop on WhatsApp after you place the order. Check the shop page before you order.",
  },
  {
    id: "faq-login",
    section: "account",
    question: "How do I log in?",
    answer: "Customers and admins use email or username plus password. Shop owners sign in with their Shop ID and password.",
  },
  {
    id: "faq-lock",
    section: "account",
    question: "What if my account is locked?",
    answer: "After several failed logins the account is locked. Contact LaGecto Support and an administrator can restore access.",
  },
  {
    id: "faq-contact",
    section: "general",
    question: "How do I contact LaGecto Support?",
    answer: "Phone +263 71 503 4314, email lagecto@outlook.com, or WhatsApp from the Support page.",
  },
];

export function imageForCategory(category?: string | null) {
  const key = String(category || "other").toLowerCase();
  return CATEGORY_IMAGES[key] || CATEGORY_IMAGES.other;
}

export function productImage(image?: string | null, category?: string | null) {
  if (image && /^(https?:\/\/|\/)/.test(image)) return image;
  return imageForCategory(category);
}

function asShop(value: unknown): { id: string; name: string; slug?: string | null; status?: string; logo_url?: string | null } | null {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as { id: string; name: string; slug?: string | null }) ?? null;
  return value as { id: string; name: string; slug?: string | null; status?: string; logo_url?: string | null };
}

export function filterShowcase(category?: string, q?: string) {
  const query = q?.trim().toLowerCase() || "";
  return SHOWCASE_PRODUCTS.filter((product) => {
    const categoryOk = !category || category === "all" || product.category === category;
    const queryOk =
      !query ||
      product.name.toLowerCase().includes(query) ||
      product.category.toLowerCase().includes(query);
    return categoryOk && queryOk;
  });
}

function safeSearch(value?: string) {
  return String(value || "")
    .replace(/[%_,()]/g, " ")
    .trim()
    .slice(0, 80);
}

export async function getPublicProducts(options?: {
  q?: string;
  category?: string;
  limit?: number;
  popular?: boolean;
}) {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createServerSupabase();
    let query = supabase
      .from("products")
      .select(
        "id, name, price, image, category, type, is_popular, created_at, shop_id, shops!inner(id, name, slug, status, logo_url)",
      )
      .eq("is_available", true)
      .eq("shops.status", "active");

    const category = options?.category && options.category !== "all" ? options.category : "";
    const q = safeSearch(options?.q);
    if (category) query = query.ilike("category", category);
    if (q) query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
    if (options?.popular) query = query.eq("is_popular", true);

    query = query.order("is_popular", { ascending: false }).order("created_at", { ascending: false });
    if (options?.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map((row) => {
      const shop = asShop(row.shops);
      return {
        id: row.id as string,
        shopId: (row.shop_id as string) || shop?.id || null,
        shopSlug: shop?.slug || null,
        shopName: shop?.name || "Shop",
        name: row.name as string,
        price: Number(row.price || 0),
        image: productImage(row.image as string | null, row.category as string | null),
        category: String(row.category || "other").toLowerCase(),
        type: (row.type as "product" | "service") || "product",
        isPopular: Boolean(row.is_popular),
        isShowcase: false,
      } satisfies PublicProduct;
    });
  } catch {
    return [];
  }
}

export async function getPublicShops(options?: { q?: string; category?: string }) {
  if (!isSupabaseConfigured()) return [];
  try {
    const { expireDueSubscriptions } = await import("@/lib/entitlements");
    await expireDueSubscriptions();
    const supabase = await createServerSupabase();
    let query = supabase
      .from("shops")
      .select(
        "id, name, slug, category, address, avg_rating, total_reviews, is_open, auto_close, opening_hours, logo_url, banner_url, verification_status, about",
      )
      .eq("status", "active")
      .order("name");

    const q = safeSearch(options?.q);
    if (q) query = query.ilike("name", `%${q}%`);
    if (options?.category && options.category !== "all") query = query.eq("category", options.category);

    const { data, error } = await query;
    if (error || !data) return [];
    const { loadShopBadgesMap } = await import("@/lib/loyalty/load");
    const badges = await loadShopBadgesMap(data.map((shop) => shop.id));

    return data.map(
      (shop) =>
        ({
          id: shop.id,
          name: shop.name,
          slug: shop.slug || null,
          category: shop.category,
          address: shop.address,
          avgRating: Number(shop.avg_rating || 0),
          totalReviews: Number(shop.total_reviews || 0),
          isOpen: shopIsOpenNow(shop),
          logoUrl: shop.logo_url,
          bannerUrl: shop.banner_url,
          verificationStatus: shop.verification_status,
          about: shop.about,
          badges: badges.get(shop.id) || [],
        }) satisfies PublicShop,
    );
  } catch {
    return [];
  }
}

export async function getPublicShop(id: string) {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createServerSupabase();
    const { data: shop } = await supabase
      .from("shops")
      .select(
        "id, name, slug, category, address, phone, email, about, avg_rating, total_reviews, is_open, logo_url, banner_url, verification_status, delivery_time, is_pickup_only, whatsapp_number",
      )
      .eq("id", id)
      .eq("status", "active")
      .maybeSingle();
    if (!shop) return null;
    const { loadShopBadgesMap } = await import("@/lib/loyalty/load");
    const badges = await loadShopBadgesMap([shop.id]);
    return { ...shop, badges: badges.get(shop.id) || [] };
  } catch {
    return null;
  }
}

export async function getPublicShopProducts(shopId: string) {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createServerSupabase();
    const { data } = await supabase
      .from("products")
      .select("id, name, price, image, category, type, description, is_popular")
      .eq("shop_id", shopId)
      .eq("is_available", true)
      .order("name");
    return data || [];
  } catch {
    return [];
  }
}

export async function getPublicFaqs() {
  if (!isSupabaseConfigured()) return FALLBACK_FAQS;
  try {
    const supabase = await createServerSupabase();
    const full = await supabase
      .from("faq_entries")
      .select("id, section, question, answer, is_archived")
      .eq("is_published", true)
      .order("sort_order");
    const fallback = full.error
      ? await supabase.from("faq_entries").select("id, section, question, answer").eq("is_published", true).order("sort_order")
      : null;
    const rows = ((full.data || fallback?.data || []) as (PublicFaq & { is_archived?: boolean })[]).filter((row) => !row.is_archived);
    if (!rows.length) return FALLBACK_FAQS;
    return rows as PublicFaq[];
  } catch {
    return FALLBACK_FAQS;
  }
}

export function mergeCatalog(live: PublicProduct[], category?: string, q?: string, minCount = 8) {
  if (live.length >= minCount) return live;
  const extras = filterShowcase(category, q).filter(
    (item) => !live.some((product) => product.category === item.category && product.name === item.name),
  );
  return [...live, ...extras].slice(0, Math.max(minCount, live.length));
}
