import Link from "next/link";
import { notFound } from "next/navigation";
import { getStorefrontBySlug, getStorefrontCatalog, getStorefrontExtras } from "@/lib/storefront/load";
import { storefrontPath } from "@/lib/storefront/paths";
import { PricedProductCard } from "@/components/storefront/PricedProductCard";
import { PRODUCT_GRID_CLASS } from "@/components/public/ProductCard";
import { StorefrontVideo } from "@/components/storefront/StorefrontVideo";
import { StorefrontLogo, StorefrontHeroBackdrop } from "@/components/storefront/StorefrontChrome";
import { MediaPreview } from "@/components/media/MediaPreview";
import { TrackEvent } from "@/components/analytics/TrackEvent";
import { money, formatDate } from "@/lib/format";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";
import { blogMediaUrl } from "@/lib/storefront/load";
import { ShopBadgePills } from "@/components/loyalty/BadgeCard";
import { loadShopBadgesMap } from "@/lib/loyalty/load";
import { StorefrontStory } from "@/components/storefront/StorefrontStory";
import { StorefrontReviews } from "@/components/storefront/StorefrontReviews";
import { StorefrontSocialLinks } from "@/components/storefront/StorefrontSocialLinks";
import { ShareStorefrontButton } from "@/components/storefront/ShareStorefrontButton";

export default async function StorefrontHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getStorefrontBySlug(slug);
  if (!data) notFound();
  const { shop, config } = data;
  const [catalog, extras, badgeMap] = await Promise.all([
    getStorefrontCatalog(shop.id),
    getStorefrontExtras(shop.id),
    loadShopBadgesMap([shop.id]),
  ]);
  const shopBadges = badgeMap.get(shop.id) || [];
  const products = catalog.filter((item) => item.type === "product");
  const services = catalog.filter((item) => item.type === "service");
  const featured = catalog.filter((item) => item.is_popular).slice(0, 8);
  const popular = featured.length ? featured : catalog.slice(0, 8);
  const base = storefrontPath(shop.slug);

  return (
    <>
      <TrackEvent eventType="shop_view" shopId={shop.id} />
      <section className="relative overflow-hidden" style={{ background: "var(--sf-primary)" }}>
        <StorefrontHeroBackdrop bannerUrl={shop.banner_url} coverPosition={config?.cover_position} />
        <div className="relative mx-auto flex min-h-[380px] max-w-6xl flex-col justify-end gap-5 px-4 pb-12 pt-20 text-white sm:min-h-[420px]">
          <div className="absolute left-4 top-5 sm:left-4 sm:top-6">
            <StorefrontLogo shop={shop} size={40} className="shadow-md ring-2 ring-white/90" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/80">
                {shop.verified ? "Verified shop" : "LaGecto shop"}
              </p>
              <VerifiedBadge verified={shop.verified} />
            </div>
            <ShopBadgePills badges={shopBadges} tone="onDark" />
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{config?.hero_title || shop.name}</h1>
            <p className="mt-2 max-w-xl text-white/90">{config?.hero_subtitle || config?.tagline || shop.about || "Welcome in."}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href={`${base}/products`}
              className="min-h-11 rounded-full px-5 py-3 text-center text-sm font-semibold text-white"
              style={{ background: "color-mix(in srgb, #04180f 38%, var(--sf-primary))" }}
            >
              {config?.cta_label || "Shop now"}
            </Link>
            <Link href={`${base}/contact`} className="min-h-11 rounded-full bg-white px-5 py-3 text-center text-sm font-semibold" style={{ color: "var(--sf-primary)" }}>
              Contact
            </Link>
            <Link href={`${base}/contact`} className="min-h-11 rounded-full border border-white/40 px-5 py-3 text-center text-sm font-semibold text-white">
              Message shop
            </Link>
            <ShareStorefrontButton slug={shop.slug} shopName={shop.name} />
          </div>
          <StorefrontSocialLinks shop={shop} className="text-white" />
        </div>
      </section>

      {shop.about ? (
        <section className="mx-auto max-w-6xl px-4 py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--sf-primary)" }}>
            Introduction
          </p>
          <p className="mt-3 max-w-3xl text-lg leading-8">{shop.about}</p>
        </section>
      ) : null}

      <StorefrontStory shop={shop} />

      {popular.length ? (
        <section className="mx-auto max-w-6xl px-4 pb-12">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-2xl font-semibold">Featured</h2>
            <Link href={`${base}/products`} className="text-sm font-medium" style={{ color: "var(--sf-primary)" }}>
              See all
            </Link>
          </div>
          <div className={PRODUCT_GRID_CLASS}>
            {popular.map((item) => (
              <PricedProductCard key={item.id} product={item} shop={shop} />
            ))}
          </div>
        </section>
      ) : null}

      {extras.promotions.length ? (
        <section className="mx-auto max-w-6xl px-4 pb-12">
          <h2 className="mb-5 text-2xl font-semibold">Promotions</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {extras.promotions.map((promo) => (
              <article key={promo.id} className="sf-card overflow-hidden">
                {promo.image ? <MediaPreview url={promo.image} title={promo.title} className="h-36 w-full" /> : null}
                <Link href={`${base}/promotions`} className="block p-4">
                  <p className="font-semibold">{promo.title}</p>
                  <p className="text-sm" style={{ color: "var(--sf-muted)" }}>
                    {promo.discount ? `${promo.discount}% off` : promo.promo_price != null ? money(promo.promo_price) : "Special offer"}
                  </p>
                </Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {products.length ? (
        <section className="mx-auto max-w-6xl px-4 pb-12">
          <h2 className="mb-5 text-2xl font-semibold">Products</h2>
          <div className={PRODUCT_GRID_CLASS}>
            {products.slice(0, 8).map((item) => (
              <PricedProductCard key={item.id} product={item} shop={shop} />
            ))}
          </div>
        </section>
      ) : null}

      {services.length ? (
        <section className="mx-auto max-w-6xl px-4 pb-12">
          <h2 className="mb-5 text-2xl font-semibold">Services</h2>
          <div className={PRODUCT_GRID_CLASS}>
            {services.slice(0, 8).map((item) => (
              <PricedProductCard key={item.id} product={item} shop={shop} />
            ))}
          </div>
        </section>
      ) : null}

      {extras.videos.length ? (
        <section className="mx-auto max-w-6xl px-4 pb-12">
          <h2 className="mb-5 text-2xl font-semibold">See what we do</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {extras.videos.map((video) => (
              <StorefrontVideo key={video.id} title={video.title} url={video.url} />
            ))}
          </div>
        </section>
      ) : null}

      {extras.media.length ? (
        <section className="mx-auto max-w-6xl px-4 pb-12">
          <h2 className="mb-5 text-2xl font-semibold">Gallery</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {extras.media.map((item) => (
              <MediaPreview key={item.id} url={item.url} title={item.alt_text || "Gallery"} className="aspect-square rounded-[22px]" />
            ))}
          </div>
        </section>
      ) : null}

      {extras.posts.length ? (
        <section className="mx-auto max-w-6xl px-4 pb-12">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-2xl font-semibold">Latest from the blog</h2>
            <Link href={`${base}/blog`} className="text-sm font-medium" style={{ color: "var(--sf-primary)" }}>
              All posts
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {extras.posts.map((post) => (
              <article key={post.id} className="sf-card overflow-hidden">
                {blogMediaUrl(post) ? <MediaPreview url={blogMediaUrl(post) || ""} title={post.title} className="h-36 w-full" /> : null}
                <Link href={`${base}/blog/${post.id}`} className="block p-4">
                  <p className="font-semibold">{post.title}</p>
                  <p className="mt-1 text-sm" style={{ color: "var(--sf-muted)" }}>
                    {post.excerpt || formatDate(post.published_at)}
                  </p>
                </Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <StorefrontReviews reviews={extras.reviews} />

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="sf-card p-6">
          <h2 className="text-2xl font-semibold">Visit {shop.name}</h2>
          <p className="mt-2" style={{ color: "var(--sf-muted)" }}>
            {shop.address || "Address not listed"}
          </p>
          <p className="mt-1" style={{ color: "var(--sf-muted)" }}>
            {shop.phone || shop.email || shop.whatsapp_number || "Message this shop from your cart"}
          </p>
          <StorefrontSocialLinks shop={shop} className="mt-4" />
          <Link href={`${base}/contact`} className="sf-btn mt-4">
            Shop details
          </Link>
        </div>
      </section>
    </>
  );
}
