import Link from "next/link";
import { money } from "@/lib/format";
import { productHref } from "@/lib/storefront/paths";
import type { PublicProduct } from "@/lib/public-catalog";
import type { PricedProduct } from "@/lib/marketplace/discovery";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { MediaPreview } from "@/components/media/MediaPreview";

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
    <article className="group overflow-hidden rounded-2xl bg-[var(--lagecto-ivory)] shadow-[var(--lg-shadow)] ring-1 ring-[var(--lagecto-border)] transition duration-200 hover:-translate-y-1 hover:shadow-[var(--lg-shadow-hover)] sm:rounded-[22px]">
      <div className="relative aspect-square overflow-hidden bg-[#eee8d8]">
        <MediaPreview url={product.image} title={product.name} className="absolute inset-0 h-full w-full" interactive={false} />
        {"isShowcase" in product && product.isShowcase ? (
          <span className="absolute left-2 top-2 z-[2] rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-[#6B7280] sm:text-[11px]">
            Featured
          </span>
        ) : null}
        {onSale ? (
          <span className="absolute right-2 top-2 z-[2] rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-[#0B6E4F] sm:text-[11px]">
            -{pct}%
          </span>
        ) : null}
        <Link href={href} className="absolute inset-0 z-[1]" aria-label={product.name} />
      </div>
      <Link href={href} className="block p-2.5 pb-0 sm:p-3.5 sm:pb-0">
        <p className="line-clamp-2 text-sm font-medium leading-tight sm:text-base">{product.name}</p>
        <p className="mt-0.5 line-clamp-1 text-xs text-[var(--lagecto-muted)] sm:text-sm">{product.shopName}</p>
        <p className="mt-1 text-sm font-semibold text-[#0B6E4F] sm:mt-2 sm:text-base">
          {money(unit)}
          {onSale ? <span className="ml-1 text-xs font-normal text-[var(--lagecto-muted)] line-through sm:ml-2 sm:text-sm">{money(list)}</span> : null}
        </p>
      </Link>
      {shopId ? (
        <div className="px-2.5 pb-2.5 sm:px-3.5 sm:pb-3.5">
          <AddToCartButton
            product={{
              productId: product.id,
              shopId,
              shopName: product.shopName,
              name: product.name,
              price: unit,
              image: product.image,
              type: product.type,
            }}
          />
        </div>
      ) : null}
    </article>
  );
}

export const PRODUCT_GRID_CLASS = "grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4";

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
    <div className="lg-card p-10 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--lagecto-muted)]">{body}</p>
      {href && label ? (
        <Link href={href} className="mt-4 inline-block font-semibold text-[#0B6E4F]">
          {label}
        </Link>
      ) : null}
    </div>
  );
}
