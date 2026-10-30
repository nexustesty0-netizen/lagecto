import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig, isSupabaseConfigured } from "@/lib/env";

export type StorefrontOgShop = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  about: string | null;
  banner_url: string | null;
  logo_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  tagline: string | null;
};

function clampText(value: string, max: number) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 3)).trim()}...`;
}

export function storefrontOgDescription(shop: {
  name: string;
  meta_description?: string | null;
  tagline?: string | null;
  about?: string | null;
}) {
  return clampText(
    shop.meta_description || shop.tagline || shop.about || `Shop ${shop.name} on LaGecto.`,
    180,
  );
}

export async function getStorefrontOgShop(slug: string): Promise<StorefrontOgShop | null> {
  if (!isSupabaseConfigured()) return null;
  const { url, anonKey } = getPublicSupabaseConfig();
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: shop } = await supabase
    .from("shops")
    .select("id, name, slug, category, about, banner_url, logo_url, meta_title, meta_description")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (!shop?.slug) return null;

  const { data: config } = await supabase
    .from("shop_storefront_config")
    .select("tagline, hero_title")
    .eq("shop_id", shop.id)
    .maybeSingle();

  return {
    ...shop,
    tagline: config?.tagline || config?.hero_title || shop.about || null,
  };
}

export async function imageDataUrl(url?: string | null) {
  const href = String(url || "").trim();
  if (!/^https:\/\//i.test(href)) return null;
  try {
    const res = await fetch(href, {
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") || "").split(";")[0]?.trim();
    if (!type?.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > 3_500_000) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
