import Link from "next/link";
import { money } from "@/lib/format";
import { availabilityLabel, isOnOrder } from "@/lib/product-availability";
import { catalogPriceLabel, catalogTimeframeLabel } from "@/lib/storefront/catalog-display";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { productHref } from "@/lib/storefront/paths";

type CatalogItem = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  icon?: string | null;
  listPrice: number;
  unitPrice: number;
  onSale?: boolean;
  type?: "product" | "service";
  availability?: "available" | "on_order" | null;
  stock?: number | null;
  hasPhoto?: boolean;
  duration?: string | null;
};

export function withPhotos<T extends { hasPhoto?: boolean }>(items: T[]) {
  return items.filter((item) => item.hasPhoto);
}

export function withoutPhotos<T extends { hasPhoto?: boolean }>(items: T[]) {
  return items.filter((item) => !item.hasPhoto);
}

function initialFor(name: string) {
  const letter = name.trim().charAt(0);
  return letter ? letter.toUpperCase() : "•";
}

export function StorefrontCatalogList({
  title,
  items,
  shop,
  embedded = false,
}: {
  title: string;
  items: CatalogItem[];
  shop: { id: string; slug?: string | null; name?: string; delivery_time?: string | null; is_pickup_only?: boolean };
  embedded?: boolean;
}) {
  const listed = withoutPhotos(items);
  if (!listed.length) return null;

  return (
    <section className={embedded ? "mt-8" : "mx-auto max-w-6xl px-4 pb-12"}>
      <div className="mb-5">
        <h2 className="text-2xl font-semibold">{title}</h2>
      </div>
      <div className="grid items-stretch gap-3 sm:grid-cols-2">
        {listed.map((item, index) => {
          const onSale = Boolean(item.onSale && item.unitPrice < item.listPrice);
          const onOrder = isOnOrder(item.availability);
          const href = productHref(shop, item.id);
          const delivery = catalogTimeframeLabel(item.type, item.duration, shop.delivery_time, shop.is_pickup_only);
          const tone = index % 3 === 1 ? "var(--sf-secondary)" : index % 3 === 2 ? "var(--sf-accent)" : "var(--sf-primary)";
          return (
            <article key={item.id} className="sf-card relative flex h-full flex-col overflow-hidden p-4">
              <div className="relative flex flex-1 flex-col">
                <div className="flex items-start gap-3">
                  <span
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
                    style={{
                      color: tone,
                      background: `color-mix(in srgb, ${tone} 12%, transparent)`,
                      boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 22%, transparent)`,
                    }}
                  >
                    {item.icon || item.category ? (
                      <CategoryIcon slug={item.icon || item.category} className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-semibold">{initialFor(item.name)}</span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={href} className="text-base font-semibold leading-snug hover:underline">
                        {item.name}
                      </Link>
                      {item.category ? (
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                          style={{
                            color: tone,
                            background: `color-mix(in srgb, ${tone} 10%, transparent)`,
                          }}
                        >
                          {item.category}
                        </span>
                      ) : null}
                    </div>
                    {item.type === "service" ? null : (
                    <p className="mt-1 text-xs font-semibold" style={{ color: onOrder ? "var(--sf-secondary)" : "var(--sf-primary)" }}>
                      {availabilityLabel(item.availability)}
                    </p>
                    )}
                  </div>
                </div>
                {item.description ? (
                  <p className="mt-2 line-clamp-2 text-sm leading-6" style={{ color: "var(--sf-muted)" }}>
                    {item.description}
                  </p>
                ) : null}
                {delivery ? (
                  <p className="mt-1 text-xs" style={{ color: "var(--sf-muted)" }}>
                    {delivery}
                  </p>
                ) : null}
                <p className="mt-3 text-lg font-semibold" style={{ color: "var(--sf-primary)" }}>
                  {catalogPriceLabel(item.unitPrice)}
                  {onSale ? (
                    <span className="ml-2 text-sm font-normal line-through" style={{ color: "var(--sf-muted)" }}>
                      {money(item.listPrice)}
                    </span>
                  ) : null}
                </p>
                <div className="mt-auto pt-4">
                  <AddToCartButton
                    size="default"
                    product={{
                      productId: item.id,
                      shopId: shop.id,
                      shopName: shop.name || "Shop",
                      name: item.name,
                      price: item.unitPrice,
                      type: item.type || "product",
                      availability: item.availability,
                      stock: item.stock,
                    }}
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
