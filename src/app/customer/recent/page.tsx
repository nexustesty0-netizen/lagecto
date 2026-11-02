import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { ProductGrid } from "@/components/public/ProductCard";
import { loadRecentlyViewed } from "@/lib/customer/home";

export default async function RecentlyViewedPage() {
  const profile = await requireRole("customer");
  const products = await loadRecentlyViewed(profile.id, 24);
  return (
    <>
      <PageHeader
        title="Recently viewed"
        subtitle="Products you opened while signed in. This list is only for your account."
      />
      {!products.length ? (
        <EmptyState
          title="No recently viewed products"
          body="Open a product from the marketplace and it will appear here."
          action={
            <Link href="/marketplace" className="lg-btn">
              Browse marketplace
            </Link>
          }
        />
      ) : (
        <ProductGrid products={products} />
      )}
    </>
  );
}
