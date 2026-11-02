import { requireRole } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { loadPublicPromotions, asOne } from "@/lib/loyalty/load";
import { money, formatDate } from "@/lib/format";
import Link from "next/link";
import { AdStrip } from "@/components/ads/AdStrip";

export default async function CustomerPromotionsPage() {
  const profile = await requireRole("customer");
  const { codes: liveCodes, shopPromos: liveShopPromos, expiringSoon: expiring } = await loadPublicPromotions(profile.id);

  return (
    <>
      <PageHeader title="Promotions" subtitle="Only live, in-date offers appear here. Apply codes at checkout — the server calculates the discount." />
      <AdStrip className="mb-6" />
      {expiring.length ? (
        <p className="mb-4 text-sm text-[#C47B12]">{expiring.length} offer{expiring.length === 1 ? "" : "s"} expire within 48 hours.</p>
      ) : null}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Promo codes</h2>
        {!liveCodes.length ? (
          <EmptyState
            title="No live codes"
            body="When LaGecto or a shop publishes a code you are eligible for, it will show here."
            action={
              <Link href="/marketplace" className="inline-flex rounded-full bg-[#0B6E4F] px-4 py-2 text-sm font-semibold text-white">
                Browse shops
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {liveCodes.map((code) => {
              const shop = asOne(code.shops as { name?: string; slug?: string } | { name?: string; slug?: string }[] | null);
              return (
                <article key={code.id} className="lg-card p-5">
                  <p className="text-xs uppercase tracking-[0.16em] text-[#D4AF37]">{code.owner_scope === "platform" ? "LaGecto" : shop?.name || "Shop"}</p>
                  <p className="mt-2 font-mono text-xl font-semibold text-[#0B6E4F]">{code.code}</p>
                  <p className="mt-1 font-semibold">{code.name}</p>
                  <p className="text-sm text-[var(--lagecto-muted)]">{code.description}</p>
                  <p className="mt-2 text-sm">
                    {code.discount_type === "percent"
                      ? `${code.percent_off}% off`
                      : code.discount_type === "fixed"
                        ? `${money(code.amount_off)} off`
                        : "Free delivery where the shop offers delivery"}
                    {Number(code.min_order_amount) ? ` · min ${money(code.min_order_amount)}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-[var(--lagecto-muted)]">
                    {code.loyalty_only ? "Loyalty members · " : ""}
                    {code.ends_at ? `Ends ${formatDate(code.ends_at)}` : "No listed end date"}
                  </p>
                  <Link href="/customer/cart" className="mt-3 inline-block text-sm font-semibold text-[#0B6E4F]">
                    Use at checkout
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Shop sale prices</h2>
        {!liveShopPromos.length ? (
          <p className="text-sm text-[var(--lagecto-muted)]">No shop promotions are currently flagged as active.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {liveShopPromos.map((promo) => {
              const shop = asOne(promo.shops as { name?: string; slug?: string } | { name?: string; slug?: string }[] | null);
              return (
                <article key={promo.id} className="rounded-2xl bg-white p-4">
                  <p className="font-semibold">{promo.title}</p>
                  <p className="text-sm text-[var(--lagecto-muted)]">{shop?.name}</p>
                  <p className="mt-1 text-sm">
                    {promo.discount ? `${promo.discount}% off` : promo.promo_price != null ? money(promo.promo_price) : "Special"}
                  </p>
                  {shop?.slug ? (
                    <Link href={`/s/${shop.slug}/promotions`} className="text-sm font-semibold text-[#0B6E4F]">
                      View shop
                    </Link>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
