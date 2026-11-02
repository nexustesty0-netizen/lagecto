import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdminLevel } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/primitives";
import { AdsManager } from "@/components/admin/AdsManager";

function asNamed(value: unknown): { id?: string; name?: string; slug?: string | null; banner_url?: string | null; status?: string } | null {
  if (!value) return null;
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === "object" ? (row as { id?: string; name?: string; slug?: string | null; banner_url?: string | null }) : null;
}

export default async function AdminAdsPage() {
  await requireAdminLevel("admin");
  const supabase = await createServerSupabase();
  const [{ data: ads }, { data: shops }, { data: products }, { data: promotions }] = await Promise.all([
    supabase.from("marketplace_ads").select("*").order("created_at", { ascending: false }),
    supabase.from("shops").select("id, name, slug, banner_url, logo_url").eq("status", "active").order("name"),
    supabase
      .from("products")
      .select("id, name, image, shop_id, shops!inner(id, name, slug, banner_url, status)")
      .eq("is_available", true)
      .eq("shops.status", "active")
      .order("name")
      .limit(300),
    supabase
      .from("promotions")
      .select("id, title, image, shops!inner(name, slug, status)")
      .eq("is_active", true)
      .eq("shops.status", "active")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <>
      <PageHeader
        title="Ads"
        subtitle="Promote a shop (uses its banner) or a product (uses its photo). Live ads appear on the marketplace, shops, news, and customer home."
      />
      <AdsManager
        ads={ads || []}
        shops={shops || []}
        products={(products || []).map((row) => {
          const shop = asNamed(row.shops);
          return {
            id: row.id,
            name: row.name,
            image: row.image,
            shop_id: row.shop_id,
            shop_name: shop?.name || "Shop",
            shop_slug: shop?.slug || null,
            shop_banner: shop?.banner_url || null,
          };
        })}
        promotions={(promotions || []).map((row) => {
          const shop = asNamed(row.shops);
          return {
            id: row.id,
            title: row.title,
            image: row.image,
            shop_name: shop?.name || "Shop",
            shop_slug: shop?.slug || null,
          };
        })}
      />
    </>
  );
}
