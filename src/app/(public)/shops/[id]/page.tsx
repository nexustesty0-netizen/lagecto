import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { money, titleCase } from "@/lib/format";
import { getPublicShop, getPublicShopProducts, productImage } from "@/lib/public-catalog";
import { getStorefrontById } from "@/lib/storefront/load";
import { storefrontPath } from "@/lib/storefront/paths";
import { shopWhatsAppUrl } from "@/lib/brand";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { ShopBadgePills } from "@/components/loyalty/BadgeCard";
import { PRODUCT_GRID_CLASS } from "@/components/public/ProductCard";

export const metadata: Metadata = { title: "Shop" };

export default async function PublicShopPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const storefront = await getStorefrontById(id);
  if (storefront?.shop.slug) redirect(storefrontPath(storefront.shop.slug));

  const shop = await getPublicShop(id);
  if (!shop) notFound();
  const products = await getPublicShopProducts(id);
  const whatsapp = shopWhatsAppUrl(
    shop.whatsapp_number || shop.phone,
    `Hello ${shop.name}, I found you on LaGecto and would like to order.`,
  );

  return (
    <article className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm text-[#6B7280]">
        <Link href="/shops" className="text-[#0B6E4F]">
          Shops
        </Link>{" "}
        / {shop.name}
      </p>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold">{shop.name}</h1>
            <VerifiedBadge verified={shop.verification_status === "verified"} />
            <ShopBadgePills badges={shop.badges} />
          </div>
          <p className="mt-2 text-[#6B7280]">{shop.about || titleCase(shop.category)}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 text-sm text-[#6B7280] shadow-sm">
          <p>{shop.address || "Address not listed"}</p>
          <p className="mt-1">{shop.phone || shop.email || "Contact the shop from your cart on WhatsApp"}</p>
          <p className="mt-1">Pickup: {shop.is_pickup_only ? "Pickup only" : shop.delivery_time || "Shop hours"}</p>
          <p className="mt-3">
            <VerifiedBadge verified={shop.verification_status === "verified"} />
          </p>
        </div>
      </div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link href="/cart" className="min-h-11 rounded-full bg-[#0B6E4F] px-5 py-2.5 text-center text-sm font-semibold text-white">
          Checkout via WhatsApp
        </Link>
        {whatsapp ? (
          <a href={whatsapp} className="min-h-11 rounded-full border border-[#E5E7EB] bg-white px-5 py-2.5 text-center text-sm font-medium">
            Message on WhatsApp
          </a>
        ) : null}
        <Link href="/support" className="min-h-11 rounded-full border border-[#E5E7EB] bg-white px-5 py-2.5 text-center text-sm font-medium">
          Need help?
        </Link>
      </div>
      <h2 className="mb-4 mt-10 text-xl font-semibold">Products</h2>
      {!products.length ? (
        <div className="rounded-2xl bg-white p-8 text-sm text-[#6B7280] shadow-sm">
          This shop has not published products yet.
        </div>
      ) : (
        <div className={PRODUCT_GRID_CLASS}>
          {products.map((product) => (
            <article key={product.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 sm:rounded-2xl">
              <div className="aspect-square bg-[#F3F4F6]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={productImage(product.image, product.category)}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-2.5 sm:p-3">
                <p className="line-clamp-2 text-sm font-medium leading-tight sm:text-base">{product.name}</p>
                <p className="mt-1 text-sm font-semibold text-[#0B6E4F] sm:text-base">{money(Number(product.price))}</p>
                <AddToCartButton
                  product={{
                    productId: product.id,
                    shopId: shop.id,
                    shopName: shop.name,
                    name: product.name,
                    price: Number(product.price),
                    image: product.image,
                    type: product.type === "service" ? "service" : "product",
                  }}
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </article>
  );
}
