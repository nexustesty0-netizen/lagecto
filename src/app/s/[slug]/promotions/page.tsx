import { notFound } from "next/navigation";
import { getStorefrontBySlug, getStorefrontExtras } from "@/lib/storefront/load";
import { money, formatDate } from "@/lib/format";
import { MediaPreview } from "@/components/media/MediaPreview";

export default async function StorefrontPromotionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getStorefrontBySlug(slug);
  if (!data) notFound();
  const extras = await getStorefrontExtras(data.shop.id);
  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Promotions</h1>
      {!extras.promotions.length ? (
        <p className="mt-6 text-sm" style={{ color: "var(--sf-muted)" }}>
          No live promotions right now.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {extras.promotions.map((promo) => (
            <article key={promo.id} className="sf-card overflow-hidden">
              {promo.image ? <MediaPreview url={promo.image} title={promo.title} className="h-44 w-full" /> : null}
              <div className="p-5">
                <h2 className="text-xl font-semibold">{promo.title}</h2>
                <p className="mt-2">
                  {promo.original_price != null && promo.promo_price != null ? (
                    <>
                      <span className="font-semibold">{money(promo.promo_price)}</span>
                      <span className="ml-2 line-through opacity-60">{money(promo.original_price)}</span>
                    </>
                  ) : promo.discount != null ? (
                    `${promo.discount}% off`
                  ) : (
                    "Special offer"
                  )}
                </p>
                <p className="mt-1 text-sm" style={{ color: "var(--sf-muted)" }}>
                  {promo.ends_at || promo.expiry_date ? `Until ${formatDate(promo.ends_at || promo.expiry_date)}` : ""}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
