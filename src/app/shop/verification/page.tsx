import { loadOwnedShopWithFeatures } from "@/lib/entitlements";
import { PageHeader } from "@/components/ui/primitives";
import { ShopStatusCard } from "@/components/shop/ShopStatusCard";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";
import Link from "next/link";

export default async function ShopVerificationPage() {
  const { shop, subscription } = await loadOwnedShopWithFeatures();
  if (!shop) return null;
  return (
    <>
      <PageHeader
        title="Verification"
        subtitle="The verified badge is granted automatically while a paid package is active. Shop owners cannot turn it on themselves."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <ShopStatusCard subscription={subscription} />
        <article className="lg-card p-5">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Public badge</h2>
            <VerifiedBadge verified={subscription.verified} />
          </div>
          {subscription.verified ? (
            <p className="mt-3 text-sm text-[var(--lagecto-muted)]">
              Customers see ✓ Verified on your storefront, shop cards, and listings until {subscription.endDate}.
            </p>
          ) : (
            <p className="mt-3 text-sm text-[var(--lagecto-muted)]">
              Free shops stay fully usable. Subscribe to Thabi, Kristen, or Sandra to show the verified badge.
            </p>
          )}
          <Link href="/shop/subscription" className="mt-4 inline-block font-semibold text-[#0B6E4F]">
            View packages
          </Link>
        </article>
      </div>
    </>
  );
}
