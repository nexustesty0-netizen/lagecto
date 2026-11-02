import { VerifiedBadge } from "@/components/shop/VerifiedBadge";
import type { PerformingShop } from "@/lib/analytics";
import { TOP_SHOPS_FORMULA } from "@/lib/analytics";
import { barPercent } from "@/lib/chart-math";

export function TopPerformingShops({ shops }: { shops: PerformingShop[] }) {
  const maxScore = Math.max(0, ...shops.map((shop) => Number(shop.score) || 0));
  return (
    <section className="lg-card overflow-hidden p-4 sm:p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="os-kicker">Marketplace pulse</p>
          <h2 className="mt-1 text-lg font-semibold sm:text-xl">Top 3 performing shops</h2>
        </div>
        <p className="hidden max-w-sm text-right text-[11px] leading-4 text-[var(--lagecto-muted)] sm:block">{TOP_SHOPS_FORMULA}</p>
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
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#E8F4EE] text-sm font-semibold text-[#0B6E4F]" aria-hidden>
                {index + 1}
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
              <div className="w-24 shrink-0 text-right sm:w-32">
                <p className="text-lg font-semibold tabular-nums text-[var(--lagecto-primary)]">{Math.round(shop.score)}</p>
                <p className="text-[11px] uppercase tracking-wide text-[var(--lagecto-muted)]">Activity</p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--lagecto-cream)]">
                  <span className="block h-full rounded-full bg-[var(--lagecto-primary)]" style={{ width: `${barPercent(shop.score, maxScore)}%` }} />
                </div>
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
