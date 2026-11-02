import Link from "next/link";
import { formatDate } from "@/lib/format";
import { DURATION_LABELS, PACKAGE_META, PACKAGE_THEME, type DurationKey } from "@/lib/packages";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";
import type { ShopSubscriptionState } from "@/lib/entitlements";

export function ShopStatusCard({ subscription }: { subscription: ShopSubscriptionState }) {
  const meta = PACKAGE_META[subscription.packageKey];
  const theme = PACKAGE_THEME[subscription.packageKey];
  const duration = subscription.durationKey ? DURATION_LABELS[subscription.durationKey as DurationKey] : null;
  const expired = subscription.status === "expired";
  return (
    <article className="overflow-hidden rounded-[var(--lg-radius)] border border-[var(--lagecto-border)] bg-white">
      <div className="h-1.5" style={{ background: theme.accent }} />
      <div className="p-4 sm:p-5">
        <p className="os-kicker">Subscription</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold sm:text-2xl">{expired ? "Free" : meta.name}</h2>
          <VerifiedBadge verified={subscription.verified} />
        </div>
        {subscription.inGrace ? (
          <p className="mt-2 text-sm text-[#C2413B]">
            Your plan ended {subscription.endDate ? formatDate(subscription.endDate) : "recently"}. You have 5 days to pay. After that the shop is deactivated and removed from Shops.
          </p>
        ) : subscription.packageKey === "free" || expired ? (
          <p className="mt-2 text-sm text-[var(--lagecto-muted)]">
            {expired
              ? `Your ${subscription.planName || "paid"} plan ended ${subscription.endDate ? formatDate(subscription.endDate) : ""}. Pay to stay listed.`
              : "No paid subscription. After a founding or paid period ends you have 5 days to pay, then the shop is delisted."}
          </p>
        ) : (
          <p className="mt-2 text-sm text-[var(--lagecto-muted)]">
            {duration} · Active until {subscription.endDate ? formatDate(subscription.endDate) : "—"} · 5-day pay window after that
          </p>
        )}
        <Link href="/shop/subscription" className="lg-btn mt-4">
          Manage package
        </Link>
      </div>
    </article>
  );
}
