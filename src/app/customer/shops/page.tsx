import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { ShopCard, SHOP_GRID_CLASS } from "@/components/public/ShopCard";
import { shopIsOpenNow } from "@/lib/hours";

export default async function CustomerShopsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createServerSupabase();
  let query = supabase
    .from("shops")
    .select("id, name, slug, category, address, avg_rating, total_reviews, is_open, auto_close, opening_hours, logo_url, banner_url, verification_status, about")
    .eq("status", "active")
    .order("name");
  if (q) query = query.ilike("name", `%${q}%`);
  const { data: shops } = await query;

  return (
    <>
      <PageHeader title="Explore shops" subtitle="Search active LaGecto shops" />
      <form className="mb-6">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search shops"
          className="w-full max-w-md rounded-xl border bg-white px-4 py-3"
        />
      </form>
      {!shops?.length ? (
        <EmptyState title="No shops found" body="Try another search, or check back after shops are published." />
      ) : (
        <div className={SHOP_GRID_CLASS}>
          {shops.map((shop) => (
            <ShopCard
              key={shop.id}
              shop={{
                id: shop.id,
                name: shop.name,
                slug: shop.slug,
                category: shop.category,
                address: shop.address,
                avgRating: Number(shop.avg_rating || 0),
                totalReviews: Number(shop.total_reviews || 0),
                isOpen: shopIsOpenNow(shop),
                logoUrl: shop.logo_url,
                bannerUrl: shop.banner_url,
                verificationStatus: shop.verification_status,
                about: shop.about,
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
