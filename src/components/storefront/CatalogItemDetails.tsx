import Link from "next/link";
import { ProductGallery } from "@/components/storefront/ProductGallery";
import { PricedProductCard } from "@/components/storefront/PricedProductCard";
import { PRODUCT_GRID_CLASS } from "@/components/public/ProductCard";
import { CatalogBuyBox } from "@/components/storefront/CatalogBuyBox";
import { AvailabilityNote } from "@/components/storefront/AvailabilityNote";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";
import { MediaPreview } from "@/components/media/MediaPreview";
import { catalogPriceLabel, catalogTimeframeLabel } from "@/lib/storefront/catalog-display";
import { productHref, storefrontPath } from "@/lib/storefront/paths";
import { isVideoMediaUrl } from "@/lib/media";

type DetailItem = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  type?: "product" | "service";
  images: string[];
  video_url?: string | null;
  listPrice: number;
  unitPrice: number;
  onSale?: boolean;
  availability?: "available" | "on_order" | null;
  stock?: number | null;
  duration?: string | null;
};

type RelatedItem = {
  id: string;
  name: string;
  image?: string | null;
  listPrice: number;
  unitPrice: number;
  onSale?: boolean;
  type?: "product" | "service";
  availability?: "available" | "on_order" | null;
  stock?: number | null;
  description?: string | null;
  duration?: string | null;
};

type DetailShop = {
  id: string;
  name: string;
  slug?: string | null;
  verified?: boolean;
  address?: string | null;
  phone?: string | null;
  delivery_time?: string | null;
  is_pickup_only?: boolean;
};

export function CatalogItemDetails({
  shop,
  item,
  related,
  loggedIn,
  showEnquire = true,
}: {
  shop: DetailShop;
  item: DetailItem;
  related: RelatedItem[];
  loggedIn: boolean;
  showEnquire?: boolean;
}) {
  const isService = item.type === "service";
  const base = storefrontPath(shop.slug || "");
  const catalogHref = isService ? `${base}/services` : `${base}/products`;
  const href = productHref(shop, item.id);
  const price = catalogPriceLabel(item.unitPrice);
  const compare = item.onSale && item.unitPrice > 0 && item.unitPrice < item.listPrice ? catalogPriceLabel(item.listPrice) : null;
  const timeframe = catalogTimeframeLabel(item.type, item.duration, shop.delivery_time, shop.is_pickup_only);
  const gallery = item.images.filter(Boolean);
  const video = isVideoMediaUrl(item.video_url) ? item.video_url : null;
  const relatedTitle = isService ? "Related services" : "Related products";

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <nav className="flex flex-wrap items-center gap-2 text-xs sm:text-sm" style={{ color: "var(--sf-muted)" }} aria-label="Breadcrumb">
        <Link href={base} className="hover:underline">{shop.name}</Link>
        <span aria-hidden>/</span>
        <Link href={catalogHref} className="hover:underline">{isService ? "Services" : "Products"}</Link>
        <span aria-hidden>/</span>
        <span className="text-[var(--sf-ink,#111)]">{item.name}</span>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:items-start">
        <div className="grid gap-4">
          <ProductGallery images={gallery} name={item.name} />
          {video ? (
            <div className="overflow-hidden rounded-[22px] bg-black">
              <MediaPreview url={video} title={item.name} playing className="w-full" />
            </div>
          ) : null}
        </div>

        <div>
          <p className="flex flex-wrap items-center gap-2 text-sm" style={{ color: "var(--sf-muted)" }}>
            {isService ? "Service" : "Product"}
            {item.category ? <span>· {item.category}</span> : null}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{item.name}</h1>
          <p className="mt-4 text-2xl font-semibold" style={{ color: "var(--sf-primary)" }}>
            {price}
            {compare ? <span className="ml-3 text-lg font-normal line-through opacity-50">{compare}</span> : null}
          </p>
          {timeframe ? (
            <p className="mt-2 text-sm" style={{ color: "var(--sf-muted)" }}>
              {timeframe}
            </p>
          ) : null}
          <AvailabilityNote
            className="mt-3 text-sm font-medium"
            availability={item.availability}
            stock={item.stock}
            type={item.type}
          />
          {item.description ? (
            <div className="mt-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--sf-muted)" }}>
                {isService ? "About this service" : "Description"}
              </h2>
              <p className="mt-2 whitespace-pre-wrap leading-7">{item.description}</p>
            </div>
          ) : null}

          <CatalogBuyBox
            product={{
              productId: item.id,
              shopId: shop.id,
              shopName: shop.name,
              name: item.name,
              price: item.unitPrice,
              image: gallery[0],
              type: item.type,
              availability: item.availability,
              stock: item.stock,
            }}
            enquire={{ loggedIn, nextPath: href, show: showEnquire }}
          />

          <aside className="sf-panel mt-8 p-5">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              {shop.name}
              <VerifiedBadge verified={shop.verified} />
            </p>
            {shop.address ? <p className="mt-2 text-sm" style={{ color: "var(--sf-muted)" }}>{shop.address}</p> : null}
            {shop.phone ? (
              <a href={`tel:${shop.phone}`} className="mt-1 block text-sm font-medium">
                {shop.phone}
              </a>
            ) : null}
            <Link href={base} className="mt-3 inline-flex text-sm font-semibold text-[var(--sf-primary)]">
              Visit shop
            </Link>
          </aside>
        </div>
      </div>

      {related.length ? (
        <div className="mt-12">
          <h2 className="text-2xl font-semibold">{relatedTitle}</h2>
          <div className={`mt-5 ${PRODUCT_GRID_CLASS}`}>
            {related.map((entry) => (
              <PricedProductCard key={entry.id} product={entry} shop={shop} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
