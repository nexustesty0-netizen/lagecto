import Link from "next/link";
import { formatDate } from "@/lib/format";
import { DURATION_LABELS, PACKAGE_META, type DurationKey } from "@/lib/packages";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";
import type { ShopSubscriptionState } from "@/lib/entitlements";

export function ShopStatusCard({ subscription }: { subscription: ShopSubscriptionState }) {
  const meta = PACKAGE_META[subscription.packageKey];
  const duration = subscription.durationKey ? DURATION_LABELS[subscription.durationKey as DurationKey] : null;
  const expired = subscription.status === "expired";
  return (
    <article className="lg-card overflow-hidden p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">Subscription</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h2 className="text-2xl font-semibold">{expired ? "FREE" : meta.name.toUpperCase()}</h2>
        <VerifiedBadge verified={subscription.verified} />
      </div>
      {subscription.packageKey === "free" || expired ? (
        <p className="mt-2 text-sm text-[var(--lagecto-muted)]">
          {expired ? `Your ${subscription.planName || "paid"} plan ended ${subscription.endDate ? formatDate(subscription.endDate) : ""}. The shop is still open on Free.` : "No paid subscription. Core shop tools stay available."}
        </p>
      ) : (
        <p className="mt-2 text-sm text-[var(--lagecto-muted)]">
          {duration} · Active until {subscription.endDate ? formatDate(subscription.endDate) : "—"}
        </p>
      )}
      <Link href="/shop/subscription" className="mt-4 inline-block text-sm font-semibold text-[#0B6E4F]">
        Manage package
      </Link>
    </article>
  );
}
