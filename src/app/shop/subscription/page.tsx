import { loadOwnedShopWithFeatures } from "@/lib/entitlements";
import { PageHeader, StatusBadge } from "@/components/ui/primitives";
import { money, formatDate } from "@/lib/format";
import { DURATION_LABELS, FEATURE_LABELS, FREE_PLAN_HIGHLIGHTS, PACKAGE_META } from "@/lib/packages";
import { loadLivePackagePrices } from "@/lib/packages.server";
import { ShopStatusCard } from "@/components/shop/ShopStatusCard";
import { PackagePicker } from "@/components/shop/PackagePicker";

export default async function ShopSubscriptionPage() {
  const [{ shop, subscription, features }, prices] = await Promise.all([
    loadOwnedShopWithFeatures(),
    loadLivePackagePrices(),
  ]);
  if (!shop) return null;
  const meta = PACKAGE_META[subscription.packageKey];
  return (
    <>
      <PageHeader
        title="Subscription"
        subtitle="Free keeps the shop running. A paid package adds a verified badge and premium tools. An admin activates the plan after payment."
      />
      <div className="mb-8">
        <ShopStatusCard subscription={subscription} />
      </div>
      {subscription.packageKey !== "free" ? (
        <article className="lg-card mb-8 p-5">
          <p className="text-sm text-[#6B7280]">{meta.tagline}</p>
          <p className="text-2xl font-semibold">{subscription.planName || meta.name}</p>
          <p className="text-[#0B6E4F]">
            {subscription.amount != null ? money(subscription.amount) : null}
            {subscription.durationKey ? ` · ${DURATION_LABELS[subscription.durationKey]}` : ""}
            {subscription.endDate ? ` · until ${formatDate(subscription.endDate)}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge value={subscription.status} />
            {subscription.paymentStatus ? <StatusBadge value={subscription.paymentStatus} /> : null}
          </div>
          <ul className="mt-4 flex flex-wrap gap-2">
            {[...features].map((feature) => (
              <li key={feature} className="rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm">
                {FEATURE_LABELS[feature] || feature}
              </li>
            ))}
          </ul>
        </article>
      ) : (
        <article className="mb-8 min-w-0 overflow-hidden rounded-[24px] border border-[var(--lagecto-border)] bg-white shadow-[var(--lg-shadow)]">
          <div className="h-1.5 bg-[#0B6E4F]" />
          <div className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--lagecto-muted)]">Always included</p>
            <p className="mt-2 font-semibold">Included on Free</p>
            <p className="mt-2 text-sm text-[#6B7280]">Every shop tool is included on Free for now.</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {FREE_PLAN_HIGHLIGHTS.map((item) => (
                <li key={item} className="rounded-2xl bg-[#E8F4EE] px-3 py-2 text-sm">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </article>
      )}
      <h2 className="mb-4 text-xl font-semibold">Choose a package</h2>
      <PackagePicker shopName={shop.name} currentPackage={subscription.packageKey} requestHref prices={prices} />
    </>
  );
}
