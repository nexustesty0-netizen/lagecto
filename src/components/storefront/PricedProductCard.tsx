import Link from "next/link";
import { money } from "@/lib/format";
import { productHref } from "@/lib/storefront/paths";
import { catalogPriceLabel, catalogTimeframeLabel } from "@/lib/storefront/catalog-display";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { MediaPreview } from "@/components/media/MediaPreview";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";
import { AvailabilityBadge, AvailabilityNote } from "@/components/storefront/AvailabilityNote";
import { CatalogMediaHotspot } from "@/components/media/MediaClick";

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
    availability?: "available" | "on_order" | null;
    stock?: number | null;
    description?: string | null;
    duration?: string | null;
  };
  shop?: {
    id: string;
    slug?: string | null;
    name?: string;
    verified?: boolean;
    delivery_time?: string | null;
    is_pickup_only?: boolean;
  };
}) {
  const href = shop
    ? productHref(shop, product.id)
    : product.shopSlug
      ? productHref({ id: product.shopId || "", slug: product.shopSlug }, product.id)
      : `/marketplace`;
  const onSale = Boolean(product.onSale && product.unitPrice < product.listPrice);
  const pct = onSale && product.listPrice > 0 ? Math.round(((product.listPrice - product.unitPrice) / product.listPrice) * 100) : 0;
  const shopId = shop?.id || product.shopId;
  const delivery = catalogTimeframeLabel(product.type, product.duration, shop?.delivery_time, shop?.is_pickup_only);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[var(--lg-radius)] bg-[var(--sf-card,#fffdf8)] ring-1 ring-black/5">
      <div className="relative aspect-square overflow-hidden bg-[#eee8d8]">
        <MediaPreview url={product.image || ""} title={product.name} className="absolute inset-0 h-full w-full" interactive={false} fit="cover" />
        {onSale ? (
          <span className="absolute left-1.5 top-1.5 z-[2] rounded-full bg-white/95 px-1.5 py-0.5 text-[9px] font-semibold text-[#0B6E4F] sm:left-2 sm:top-2 sm:px-2 sm:text-[11px]">
            -{pct}%
          </span>
        ) : null}
        <AvailabilityBadge availability={product.availability} type={product.type} />
        <CatalogMediaHotspot href={href} name={product.name} />
      </div>
      <div className="flex flex-1 flex-col p-1.5 sm:p-3.5">
        <Link href={href} className="block">
          <p className="line-clamp-2 min-h-[2.75em] text-[11px] font-medium leading-snug sm:text-base">{product.name}</p>
          {product.shopName ? (
            <p className="mt-0.5 flex min-h-[1.25em] items-center gap-1 text-[10px] text-[var(--lagecto-muted)] sm:gap-1.5 sm:text-sm">
              <span className="line-clamp-1">{product.shopName}</span>
              <VerifiedBadge verified={shop?.verified} className="hidden sm:inline-flex" />
            </p>
          ) : null}
          <p className="mt-1 truncate text-[11px] font-semibold leading-none text-[#0B6E4F] sm:mt-2 sm:text-base">
            {catalogPriceLabel(product.unitPrice)}
            {onSale ? <span className="ml-1 text-[10px] font-normal text-[var(--lagecto-muted)] line-through sm:ml-2 sm:text-sm">{money(product.listPrice)}</span> : null}
          </p>
          {delivery ? (
            <p className="mt-1 line-clamp-1 text-[10px] text-[var(--lagecto-muted)] sm:text-xs">{delivery}</p>
          ) : null}
          <AvailabilityNote
            className="mt-1 line-clamp-1 min-h-[1.25em] text-[10px] sm:text-xs"
            availability={product.availability}
            stock={product.stock}
            type={product.type}
          />
        </Link>
        {shopId ? (
          <div className="mt-auto pt-1.5 sm:pt-3">
            <AddToCartButton
              product={{
                productId: product.id,
                shopId,
                shopName: shop?.name || product.shopName || "Shop",
                name: product.name,
                price: product.unitPrice,
                image: product.image,
                type: product.type || "product",
                availability: product.availability,
                stock: product.stock,
              }}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}
