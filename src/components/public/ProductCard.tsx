import Link from "next/link";
import { money } from "@/lib/format";
import { productHref } from "@/lib/storefront/paths";
import type { PublicProduct } from "@/lib/public-catalog";
import type { PricedProduct } from "@/lib/marketplace/discovery";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { MediaPreview } from "@/components/media/MediaPreview";
import { AvailabilityBadge, AvailabilityNote } from "@/components/storefront/AvailabilityNote";

export function ProductCard({
  product,
}: {
  product: (PublicProduct & { unitPrice?: number; listPrice?: number; onSale?: boolean; shopSlug?: string | null }) | PricedProduct;
}) {
  const shopId = "shopId" in product ? product.shopId : null;
  const shopSlug = "shopSlug" in product ? product.shopSlug : null;
  const href = shopId
    ? productHref({ id: shopId, slug: shopSlug || undefined }, product.id)
    : "/signup";
  const list = "listPrice" in product ? Number(product.listPrice) : Number("price" in product ? product.price : 0);
  const unit = "unitPrice" in product ? Number(product.unitPrice) : list;
  const onSale = Boolean("onSale" in product && product.onSale && unit < list);
  const pct = onSale && list > 0 ? Math.round(((list - unit) / list) * 100) : 0;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[var(--lg-radius)] bg-[var(--lagecto-ivory)] ring-1 ring-[var(--lagecto-border)]">
      <div className="relative aspect-square overflow-hidden bg-[#eee8d8]">
        <MediaPreview url={product.image} title={product.name} className="absolute inset-0 h-full w-full" interactive={false} fit="cover" />
        {"isShowcase" in product && product.isShowcase ? (
          <span className="absolute left-1.5 top-1.5 z-[2] rounded-full bg-[var(--lagecto-primary)] px-1.5 py-0.5 text-[9px] font-semibold text-white sm:left-2 sm:top-2 sm:px-2 sm:text-[11px]">
            Featured
          </span>
        ) : null}
        {onSale ? (
          <span className="absolute right-1.5 top-1.5 z-[2] rounded-full bg-[var(--lagecto-primary-deep)] px-1.5 py-0.5 text-[9px] font-semibold text-white sm:right-2 sm:top-2 sm:px-2 sm:text-[11px]">
            -{pct}%
          </span>
        ) : null}
        {"availability" in product ? <AvailabilityBadge availability={product.availability} type={product.type} /> : null}
        <Link href={href} className="absolute inset-0 z-[1]" aria-label={product.name} />
      </div>
      <div className="flex flex-1 flex-col p-2 sm:p-3.5">
        <Link href={href} className="block">
          <p className="line-clamp-2 min-h-[2.75em] text-[11px] font-semibold leading-snug sm:text-sm">{product.name}</p>
          <p className="mt-0.5 line-clamp-1 min-h-[1.25em] text-[10px] text-[var(--lagecto-muted)] sm:text-sm">{product.shopName}</p>
          <p className="mt-1 truncate text-[11px] font-semibold leading-none text-[#0B6E4F] sm:mt-2 sm:text-base">
            {money(unit)}
            {onSale ? <span className="ml-1 text-[10px] font-normal text-[var(--lagecto-muted)] line-through sm:ml-2 sm:text-sm">{money(list)}</span> : null}
          </p>
          {"availability" in product ? (
            <AvailabilityNote
              className="mt-1 line-clamp-1 min-h-[1.25em] text-[10px] sm:text-xs"
              availability={product.availability}
              stock={"stock" in product ? product.stock : null}
              type={product.type}
            />
          ) : (
            <p className="mt-1 min-h-[1.25em]" />
          )}
        </Link>
        {shopId ? (
          <div className="mt-auto pt-1.5 sm:pt-3">
            <AddToCartButton
              product={{
                productId: product.id,
                shopId,
                shopName: product.shopName,
                name: product.name,
                price: unit,
                image: product.image,
                type: product.type,
                availability: "availability" in product ? product.availability : undefined,
                stock: "stock" in product ? product.stock : undefined,
              }}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}

export const PRODUCT_GRID_CLASS = "grid grid-cols-3 items-stretch gap-1.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4";

export function ProductGrid({
  products,
  className = PRODUCT_GRID_CLASS,
}: {
  products: Array<PublicProduct | PricedProduct>;
  className?: string;
}) {
  return (
    <div className={className}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

export function CatalogEmpty({ title, body, href, label }: { title: string; body: string; href?: string; label?: string }) {
  return (
    <div className="lg-card p-8 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--lagecto-muted)]">{body}</p>
      {href && label ? (
        <Link href={href} className="lg-btn mt-4">
          {label}
        </Link>
      ) : null}
    </div>
  );
}
