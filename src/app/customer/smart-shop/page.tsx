import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { getRecommendations } from "@/lib/marketplace/discovery";
import { ProductGrid } from "@/components/public/ProductCard";

export default async function SmartShopPage() {
  const profile = await requireRole("customer");
  const recommended = await getRecommendations({ userId: profile.id, limit: 12 });
  return (
    <>
      <PageHeader title="Smart Shopping" subtitle="Suggestions from your purchases, views and similar products. If there is not enough history, trending items are shown." />
      {!recommended.length ? (
        <EmptyState title="Nothing to recommend yet" body="Browse shops and products. Recommendations never invent listings." />
      ) : (
        <ProductGrid products={recommended} />
      )}
      <p className="mt-6 text-sm text-[var(--lagecto-muted)]">
        Want a specific shop? <Link href="/customer/shops" className="font-medium text-[#0B6E4F]">Explore shops</Link>
      </p>
    </>
  );
}
