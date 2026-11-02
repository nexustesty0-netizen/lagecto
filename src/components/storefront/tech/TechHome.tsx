import Link from "next/link";
import { ArrowRight, Mail, MapPin, Phone } from "lucide-react";
import type { StorefrontConfig, StorefrontShop } from "@/lib/storefront/load";
import { storefrontPath } from "@/lib/storefront/paths";
import { showsStorefrontProjects, techCopyFor, techHeroImage, techHeroPosition, techHomeActions, serviceIconHint } from "@/lib/storefront/template";
import { PricedProductCard } from "@/components/storefront/PricedProductCard";
import { PRODUCT_GRID_CLASS } from "@/components/public/ProductCard";
import { StorefrontPromoCard, promoHref } from "@/components/storefront/StorefrontPromoCard";
import { StorefrontLocation } from "@/components/storefront/StorefrontLocation";
import { StorefrontStory } from "@/components/storefront/StorefrontStory";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { shopWhatsAppUrl } from "@/lib/brand";
import { TechHero } from "@/components/storefront/tech/TechHero";
import { TrackEvent } from "@/components/analytics/TrackEvent";
import { StorefrontVideo } from "@/components/storefront/StorefrontVideo";
import { StorefrontReviews } from "@/components/storefront/StorefrontReviews";
import { MediaPreview } from "@/components/media/MediaPreview";
import { blogMediaUrl, projectMediaUrl, type StorefrontProject } from "@/lib/storefront/load";
import { mediaFrameClass } from "@/lib/media";
import { formatDate } from "@/lib/format";
import { hasProductPhoto } from "@/lib/placeholder-cover";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { money } from "@/lib/format";
import { catalogPriceLabel, catalogTimeframeLabel } from "@/lib/storefront/catalog-display";
import { isSocialMediaUrl, stillImageUrl } from "@/lib/media";
import { productHref } from "@/lib/storefront/paths";

type CatalogItem = {
  id: string;
  name: string;
  description?: string | null;
  image?: string | null;
  hasPhoto?: boolean;
  icon?: string | null;
  category?: string | null;
  type?: "product" | "service";
  listPrice: number;
  unitPrice: number;
  onSale?: boolean;
  availability?: "available" | "on_order" | null;
  stock?: number | null;
  duration?: string | null;
  is_popular?: boolean;
};

export function TechHome({
  shop,
  config,
  products,
  services,
  promotions,
  media,
  videos = [],
  posts = [],
  reviews = [],
  projects = [],
}: {
  shop: StorefrontShop;
  config: StorefrontConfig | null;
  products: CatalogItem[];
  services: CatalogItem[];
  promotions: Parameters<typeof StorefrontPromoCard>[0]["promo"][];
  media: { id: string; url: string; alt_text?: string | null }[];
  videos?: { id: string; title: string; url: string }[];
  posts?: { id: string; title: string; excerpt?: string | null; published_at?: string | null; media_type?: string | null; media_url?: string | null; cover_image?: string | null }[];
  reviews?: Parameters<typeof StorefrontReviews>[0]["reviews"];
  projects?: StorefrontProject[];
}) {
  const copy = techCopyFor(shop);
  const base = storefrontPath(shop.slug);
  const featuredServices = [...services].sort((a, b) => Number(Boolean(b.is_popular)) - Number(Boolean(a.is_popular))).slice(0, 4);
  const featuredProducts = products.filter((item) => item.hasPhoto).slice(0, 8);
  const productPhotos = featuredProducts.length ? featuredProducts : products.slice(0, 8);
  const intro = config?.hero_subtitle || config?.tagline || shop.about || `${shop.name} on LaGecto.`;
  const heroImage = techHeroImage("home", shop, config);
  const aboutImage = stillImageUrl(media[0]?.url, shop.banner_url, techHeroImage("about", shop, config));
  const whatsapp = shopWhatsAppUrl(shop.whatsapp_number || shop.phone, copy.whatsappMessage);
  const hasAbout = Boolean(shop.about);
  const hasStory = Boolean(shop.mission || shop.vision || shop.aim || shop.core_values || shop.service_delivery);

  return (
    <>
      <TrackEvent eventType="shop_view" shopId={shop.id} />
      <TechHero
        image={heroImage}
        kicker={copy.kicker}
        title={copy.headline}
        subtitle={intro}
        objectPosition={techHeroPosition("home", config)}
        actions={techHomeActions(shop.slug, { services: services.length > 0, products: products.length > 0 })}
      />

      {featuredServices.length ? (
        <section className="mx-auto max-w-6xl px-4 pb-4 pt-2 sm:pb-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--sf-primary)]">Services</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">What {shop.name} offers</h2>
            </div>
            <Link href={`${base}/services`} className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--sf-primary)]">
              All services <ArrowRight size={14} />
            </Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {featuredServices.map((item) => (
              <ServiceTile key={item.id} item={item} shop={shop} />
            ))}
          </div>
        </section>
      ) : null}

      {showsStorefrontProjects(shop.provider_type) && projects.length ? (
        <section className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--sf-primary)]">Projects</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">Recent work</h2>
            </div>
            <Link href={`${base}/projects`} className="text-sm font-semibold text-[var(--sf-primary)]">
              All projects
            </Link>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {projects.slice(0, 3).map((project) => (
              <article key={project.id} className="sf-panel overflow-hidden">
                {projectMediaUrl(project) ? (
                  <MediaPreview
                    url={projectMediaUrl(project) || ""}
                    title={project.title}
                    playing
                    className={mediaFrameClass(projectMediaUrl(project) || "")}
                  />
                ) : null}
                <Link href={`${base}/projects/${project.id}`} className="block p-5">
                  <p className="text-lg font-semibold">{project.title}</p>
                  <p className="mt-2 line-clamp-3 text-sm leading-6" style={{ color: "var(--sf-muted)" }}>
                    {project.summary || "View this project"}
                  </p>
                </Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {hasAbout || hasStory ? (
        <section className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
          {hasAbout ? (
            <div className="sf-panel overflow-hidden">
              <div className="grid lg:grid-cols-2">
                <div className="relative min-h-[16rem] overflow-hidden" style={{ background: "var(--sf-primary)" }}>
                  {aboutImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={aboutImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="flex flex-col justify-center p-6 sm:p-8">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--sf-primary)]">About</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">{shop.name}</h2>
                  <p className="mt-3 text-sm leading-7" style={{ color: "var(--sf-muted)" }}>{shop.about}</p>
                  <Link href={`${base}/about`} className="mt-5 inline-flex min-h-11 w-fit items-center bg-[var(--sf-primary)] px-5 text-sm font-semibold text-white">
                    Our story
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
          <StorefrontStory shop={shop} embedded />
        </section>
      ) : null}

      {promotions.length ? (
        <section className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--sf-primary)]">Promotions</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">Current offers</h2>
            </div>
            <Link href={`${base}/promotions`} className="text-sm font-semibold text-[var(--sf-primary)]">
              View offers
            </Link>
          </div>
          <div className="mt-5 grid gap-4">
            <StorefrontPromoCard promo={promotions[0]} featured href={promoHref(base, promotions[0])} />
            {promotions.length > 1 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {promotions.slice(1, 3).map((promo) => (
                  <StorefrontPromoCard key={promo.id} promo={promo} href={promoHref(base, promo)} />
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {productPhotos.length ? (
        <section className="py-8 sm:py-10" style={{ background: "color-mix(in srgb, var(--sf-primary) 6%, white)" }}>
          <div className="mx-auto max-w-6xl px-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--sf-primary)]">Products</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight">From the catalogue</h2>
              </div>
              <Link href={`${base}/products`} className="text-sm font-semibold text-[var(--sf-primary)]">
                All products
              </Link>
            </div>
            <div className={`mt-5 ${PRODUCT_GRID_CLASS}`}>
              {productPhotos.map((item) => (
                <PricedProductCard key={item.id} product={item} shop={shop} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--sf-primary)]">Contact</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Talk to {shop.name}</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <article className="sf-panel p-5">
            <Phone size={18} className="text-[var(--sf-primary)]" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sf-muted)" }}>Phone</p>
            {shop.phone ? <a href={`tel:${shop.phone}`} className="mt-1 block font-medium">{shop.phone}</a> : <p className="mt-1 text-sm" style={{ color: "var(--sf-muted)" }}>Not listed</p>}
          </article>
          <article className="sf-panel p-5">
            <Mail size={18} className="text-[var(--sf-primary)]" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sf-muted)" }}>Email</p>
            {shop.email ? <a href={`mailto:${shop.email}`} className="mt-1 block font-medium">{shop.email}</a> : <p className="mt-1 text-sm" style={{ color: "var(--sf-muted)" }}>Not listed</p>}
          </article>
          <article className="sf-panel p-5">
            <MapPin size={18} className="text-[var(--sf-primary)]" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sf-muted)" }}>Location</p>
            <p className="mt-1 text-sm">{shop.address || "Address not listed"}</p>
          </article>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {whatsapp ? (
            <a href={whatsapp} className="inline-flex min-h-11 items-center justify-center bg-[var(--sf-primary)] px-6 text-sm font-semibold text-white">
              WhatsApp {shop.name}
            </a>
          ) : null}
          <Link href={`${base}/contact`} className="inline-flex min-h-11 items-center justify-center border px-6 text-sm font-semibold" style={{ borderColor: "color-mix(in srgb, var(--sf-primary) 22%, transparent)" }}>
            Contact page
          </Link>
        </div>
        {shop.address ? (
          <StorefrontLocation address={shop.address} shopName={shop.name} phone={shop.phone} email={shop.email} embedded />
        ) : null}
      </section>

      {videos.length ? (
        <section className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--sf-primary)]">Blog / Vlog</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">See what we do</h2>
            </div>
            <Link href={`${base}/blog`} className="text-sm font-semibold text-[var(--sf-primary)]">
              All videos
            </Link>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {videos.map((video) => (
              <StorefrontVideo key={video.id} title={video.title} url={video.url} />
            ))}
          </div>
        </section>
      ) : null}

      {media.length ? (
        <section className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--sf-primary)]">Gallery</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">In the studio</h2>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            {media.map((item) => (
              <div key={item.id} className="overflow-hidden">
                <MediaPreview url={item.url} title={item.alt_text || "Gallery"} className="aspect-square" fit="cover" />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {posts.length ? (
        <section className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--sf-primary)]">Blog / Vlog</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">From the blog</h2>
            </div>
            <Link href={`${base}/blog`} className="text-sm font-semibold text-[var(--sf-primary)]">
              All posts
            </Link>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {posts.map((post) => (
              <article key={post.id} className="sf-panel overflow-hidden">
                {blogMediaUrl(post) ? (
                  <MediaPreview url={blogMediaUrl(post) || ""} title={post.title} playing className={mediaFrameClass(blogMediaUrl(post) || "")} />
                ) : null}
                <Link href={`${base}/blog/${post.id}`} className="block p-5">
                  <p className="text-xs uppercase tracking-[0.14em]" style={{ color: "var(--sf-muted)" }}>
                    {formatDate(post.published_at)}
                  </p>
                  <p className="mt-2 text-lg font-semibold">{post.title}</p>
                  <p className="mt-2 line-clamp-3 text-sm leading-6" style={{ color: "var(--sf-muted)" }}>
                    {post.excerpt || "Read the story"}
                  </p>
                </Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <StorefrontReviews reviews={reviews} />
    </>
  );
}

function ServiceTile({ item, shop }: { item: CatalogItem; shop: StorefrontShop }) {
  const photo = hasProductPhoto(item.image) && !isSocialMediaUrl(item.image || "") ? item.image : null;
  const icon = serviceIconHint(item.name, item.icon || item.category);
  const onSale = Boolean(item.onSale && item.unitPrice < item.listPrice);
  const href = productHref(shop, item.id);
  const delivery = catalogTimeframeLabel("service", item.duration, shop.delivery_time, shop.is_pickup_only);
  return (
    <article className="sf-panel flex gap-4 p-4">
      <Link href={href} className="shrink-0" aria-label={item.name}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-16 w-16 object-cover" />
        ) : (
          <span className="grid h-16 w-16 place-items-center text-[var(--sf-primary)]" style={{ background: "color-mix(in srgb, var(--sf-primary) 10%, white)" }}>
            <CategoryIcon slug={icon} className="h-6 w-6" />
          </span>
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={href} className="block">
          <h3 className="font-semibold">{item.name}</h3>
          {item.description ? <p className="mt-1 line-clamp-2 text-sm leading-6" style={{ color: "var(--sf-muted)" }}>{item.description}</p> : null}
          {delivery ? <p className="mt-1 text-xs" style={{ color: "var(--sf-muted)" }}>{delivery}</p> : null}
          <p className="mt-2 text-base font-semibold" style={{ color: "var(--sf-primary)" }}>
            {catalogPriceLabel(item.unitPrice)}
            {onSale ? (
              <span className="ml-2 text-sm font-normal line-through" style={{ color: "var(--sf-muted)" }}>
                {money(item.listPrice)}
              </span>
            ) : null}
          </p>
        </Link>
        <div className="mt-3">
          <AddToCartButton
            product={{
              productId: item.id,
              shopId: shop.id,
              shopName: shop.name,
              name: item.name,
              price: item.unitPrice,
              image: item.image,
              type: item.type || "service",
              availability: item.availability,
              stock: item.stock,
            }}
          />
        </div>
      </div>
    </article>
  );
}
