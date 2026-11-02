import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { shopHref } from "@/lib/storefront/paths";

export default async function SavedShopsPage() {
  const profile = await requireRole("customer");
  const supabase = await createServerSupabase();
  const { data: saved } = await supabase.from("saved_shops").select("shop_id, shops(id, name, category, slug, avg_rating)").eq("user_id", profile.id);
  const shops = (saved || [])
    .map((row) => {
      const related = row.shops as { id: string; name: string; category: string; slug?: string | null; avg_rating: number } | { id: string; name: string; category: string; slug?: string | null; avg_rating: number }[] | null;
      return Array.isArray(related) ? related[0] : related;
    })
    .filter((shop): shop is { id: string; name: string; category: string; slug?: string | null; avg_rating: number } => Boolean(shop));
  return (
    <>
      <PageHeader title="Wishlist" subtitle="Shops you saved. This list stays on your account only." />
      {!shops.length ? (
        <EmptyState title="No saved shops" body="Save a shop from its page to find it quickly." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {shops.map((shop) => (
            <Link key={shop.id} href={shopHref(shop)} className="rounded-2xl bg-white p-4">
              <p className="font-semibold">{shop.name}</p>
              <p className="text-sm text-[#6B7280]">{shop.category}</p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
