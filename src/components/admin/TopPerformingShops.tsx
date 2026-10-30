import { VerifiedBadge } from "@/components/shop/VerifiedBadge";
import type { PerformingShop } from "@/lib/analytics";
import { TOP_SHOPS_FORMULA } from "@/lib/analytics";

const MEDALS = ["🥇", "🥈", "🥉"];

export function TopPerformingShops({ shops }: { shops: PerformingShop[] }) {
  return (
    <section className="lg-card overflow-hidden p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">Marketplace pulse</p>
          <h2 className="mt-1 text-xl font-semibold">Top 3 performing shops</h2>
        </div>
        <p className="max-w-sm text-right text-[11px] leading-4 text-[var(--lagecto-muted)]">{TOP_SHOPS_FORMULA}</p>
      </div>
      {!shops.length ? (
        <p className="mt-6 text-sm text-[var(--lagecto-muted)]">Insufficient data for this insight.</p>
      ) : (
        <ol className="mt-5 grid gap-3">
          {shops.slice(0, 3).map((shop, index) => (
            <li
              key={shop.shop_id}
              className="top-shop-row flex items-center gap-4 rounded-2xl border px-4 py-3"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <span className="text-2xl" aria-hidden>
                {MEDALS[index]}
              </span>
              {shop.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shop.logo_url} alt="" className="h-12 w-12 rounded-2xl object-cover" />
              ) : (
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#0B6E4F] text-sm font-semibold text-white">
                  {shop.shop_name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold">{shop.shop_name}</p>
                  {shop.verification_status === "verified" ? <VerifiedBadge verified /> : null}
                </div>
                <p className="text-xs text-[var(--lagecto-muted)]">
                  {shop.paid_orders} paid orders · {shop.unique_customers} customers · {shop.engagement_events} engagement events
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-[#0B6E4F]">{Math.round(shop.score)}</p>
                <p className="text-[11px] uppercase tracking-wide text-[var(--lagecto-muted)]">Activity</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-4 text-[11px] text-[var(--lagecto-muted)]">
        This is marketplace performance, not LaGecto company revenue. Shop sales stay with the shop.
      </p>
    </section>
  );
}
