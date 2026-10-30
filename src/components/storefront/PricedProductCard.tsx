import Link from "next/link";
import { money } from "@/lib/format";
import { productHref } from "@/lib/storefront/paths";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { MediaPreview } from "@/components/media/MediaPreview";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";

export function PricedProductCard({
  product,
  shop,
}: {
  product: {
    id: string;
    name: string;
    image?: string | null;
    listPrice: number;
    unitPrice: number;
    onSale?: boolean;
    shopId?: string;
    shopName?: string;
    shopSlug?: string | null;
    type?: "product" | "service";
  };
  shop?: { id: string; slug?: string | null; name?: string; verified?: boolean };
}) {
  const href = shop
    ? productHref(shop, product.id)
    : product.shopSlug
      ? productHref({ id: product.shopId || "", slug: product.shopSlug }, product.id)
      : `/marketplace`;
  const onSale = Boolean(product.onSale && product.unitPrice < product.listPrice);
  const pct = onSale && product.listPrice > 0 ? Math.round(((product.listPrice - product.unitPrice) / product.listPrice) * 100) : 0;
  const shopId = shop?.id || product.shopId;

  return (
    <article className="group overflow-hidden rounded-2xl bg-[var(--sf-card,#fffdf8)] shadow-[var(--lg-shadow)] ring-1 ring-black/5 transition hover:-translate-y-1 sm:rounded-[22px]">
      <div className="relative aspect-square overflow-hidden bg-[#eee8d8]">
        <MediaPreview url={product.image || ""} title={product.name} className="absolute inset-0 h-full w-full" interactive={false} />
        {onSale ? (
          <span className="absolute left-2 top-2 z-[2] rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-[#0B6E4F] sm:text-[11px]">
            -{pct}%
          </span>
        ) : null}
        <Link href={href} className="absolute inset-0 z-[1]" aria-label={product.name} />
      </div>
      <Link href={href} className="block p-2.5 pb-0 sm:p-3.5 sm:pb-0">
        <p className="line-clamp-2 text-sm font-medium leading-tight sm:text-base">{product.name}</p>
        {product.shopName ? (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--lagecto-muted)] sm:text-sm">
            <span className="line-clamp-1">{product.shopName}</span>
            <VerifiedBadge verified={shop?.verified} />
          </p>
        ) : null}
        <p className="mt-1 text-sm font-semibold text-[#0B6E4F] sm:mt-2 sm:text-base">
          {money(product.unitPrice)}
          {onSale ? <span className="ml-1 text-xs font-normal text-[var(--lagecto-muted)] line-through sm:ml-2 sm:text-sm">{money(product.listPrice)}</span> : null}
        </p>
      </Link>
      {shopId ? (
        <div className="px-2.5 pb-2.5 sm:px-3.5 sm:pb-3.5">
          <AddToCartButton
            product={{
              productId: product.id,
              shopId,
              shopName: shop?.name || product.shopName || "Shop",
              name: product.name,
              price: product.unitPrice,
              image: product.image,
              type: product.type || "product",
            }}
          />
        </div>
      ) : null}
    </article>
  );
}
