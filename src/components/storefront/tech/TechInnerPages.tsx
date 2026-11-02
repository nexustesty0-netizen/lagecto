import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import type { StorefrontConfig, StorefrontShop } from "@/lib/storefront/load";
import { productHref, storefrontPath } from "@/lib/storefront/paths";
import { DEFAULT_HEROES, serviceIconHint, techCopyFor, techHeroImage, techHeroPosition } from "@/lib/storefront/template";
import { StorefrontStory } from "@/components/storefront/StorefrontStory";
import { StorefrontPromoCard, promoHref, type StorefrontPromo } from "@/components/storefront/StorefrontPromoCard";
import { PricedProductCard } from "@/components/storefront/PricedProductCard";
import { PRODUCT_GRID_CLASS } from "@/components/public/ProductCard";
import { StorefrontCatalogList, withPhotos } from "@/components/storefront/StorefrontCatalogList";
import { StorefrontLocation } from "@/components/storefront/StorefrontLocation";
import { groupedOpeningHours, hasScheduledHours, parseOpeningHours, weekdayKeyNow } from "@/lib/hours";
import { shopWhatsAppUrl } from "@/lib/brand";
import { TechHero } from "@/components/storefront/tech/TechHero";
import { TechContactForm } from "@/components/storefront/tech/TechContactForm";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { stillImageUrl } from "@/lib/media";

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
};

export function TechAboutPage({
  shop,
  config,
  media,
  services,
}: {
  shop: StorefrontShop;
  config: StorefrontConfig | null;
  media: { url: string }[];
  services: CatalogItem[];
}) {
  const copy = techCopyFor(shop);
  const base = storefrontPath(shop.slug);
  const image = techHeroImage("about", shop, config);
  const portrait = stillImageUrl(media[0]?.url, shop.banner_url, image);
  return (
    <>
      <TechHero
        image={image}
        title={copy.aboutHero}
        subtitle={config?.tagline || shop.about || `${shop.name} on LaGecto.`}
        objectPosition={techHeroPosition("about", config)}
      />
      <section className="mx-auto max-w-6xl px-4 pb-4 pt-2">
        <div className="sf-panel overflow-hidden">
          <div className="grid lg:grid-cols-2">
            <div className="relative min-h-[16rem]" style={{ background: "var(--sf-primary)" }}>
              {portrait ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={portrait} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="flex flex-col justify-center p-6 sm:p-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--sf-primary)]">Company</p>
              <h2 className="mt-2 text-2xl font-semibold">{shop.name}</h2>
              <p className="mt-3 text-sm leading-7 sm:text-base" style={{ color: "var(--sf-muted)" }}>
                {shop.about || "This shop has not added a company introduction yet."}
              </p>
            </div>
          </div>
        </div>
        <StorefrontStory shop={shop} embedded />
      </section>
      {services.length ? (
        <section className="mx-auto max-w-6xl px-4 py-8">
          <h2 className="text-2xl font-semibold">Our areas of expertise</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {services.slice(0, 8).map((item) => (
              <li key={item.id}>
                <Link href={productHref(shop, item.id)} className="sf-panel flex items-start gap-3 p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center text-[var(--sf-primary)]" style={{ background: "color-mix(in srgb, var(--sf-primary) 10%, white)" }}>
                    <CategoryIcon slug={serviceIconHint(item.name, item.icon || item.category)} className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    {item.description ? <p className="mt-1 line-clamp-2 text-sm leading-6" style={{ color: "var(--sf-muted)" }}>{item.description}</p> : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="mx-auto max-w-6xl px-4 pb-10 text-center">
        <div className="sf-panel px-6 py-8">
          <h2 className="text-2xl font-semibold">Ready to talk?</h2>
          <Link href={`${base}/contact`} className="mt-5 inline-flex min-h-11 items-center bg-[var(--sf-primary)] px-6 text-sm font-semibold text-white">
            Contact {shop.name}
          </Link>
        </div>
      </div>
    </>
  );
}

export function TechServicesPage({
  shop,
  config,
  services,
}: {
  shop: StorefrontShop;
  config: StorefrontConfig | null;
  services: CatalogItem[];
}) {
  const copy = techCopyFor(shop);
  const base = storefrontPath(shop.slug);
  const image = techHeroImage("services", shop, config);
  const pictured = withPhotos(services);
  return (
    <>
      <TechHero
        image={image}
        title={copy.servicesHero}
        subtitle={`Services from ${shop.name}. Enquire from the shop for details that fit your work.`}
        objectPosition={techHeroPosition("services", config)}
        actions={[{ href: `${base}/projects`, label: "Projects", primary: false }]}
      />
      <section id="services" className="mx-auto max-w-6xl px-4 pb-10 pt-2">
        {!services.length ? (
          <p className="sf-panel p-8 text-sm" style={{ color: "var(--sf-muted)" }}>No services published yet.</p>
        ) : (
          <>
            {pictured.length ? (
              <div className={PRODUCT_GRID_CLASS}>
                {pictured.map((item) => (
                  <PricedProductCard key={item.id} product={item} shop={shop} />
                ))}
              </div>
            ) : null}
            <StorefrontCatalogList title="Services" items={services} shop={shop} embedded />
          </>
        )}
        <div className="sf-panel mt-8 px-6 py-8 text-center">
          <h2 className="text-2xl font-semibold">Need a service scoped to your work?</h2>
          <Link href={`${base}/contact`} className="mt-5 inline-flex min-h-11 items-center bg-[var(--sf-primary)] px-6 text-sm font-semibold text-white">
            Make an enquiry
          </Link>
        </div>
      </section>
    </>
  );
}

export function TechPromotionsPage({
  shop,
  config,
  promotions,
}: {
  shop: StorefrontShop;
  config: StorefrontConfig | null;
  promotions: StorefrontPromo[];
}) {
  const copy = techCopyFor(shop);
  const image = techHeroImage("promotions", shop, config);
  const base = storefrontPath(shop.slug);
  return (
    <>
      <TechHero
        image={image}
        title={copy.promotionsHero}
        subtitle={`Live offers from ${shop.name}. Expired promotions are not shown.`}
        objectPosition={techHeroPosition("promotions", config)}
      />
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-2">
        {!promotions.length ? (
          <div className="sf-panel px-6 py-12 text-center">
            <p className="text-lg font-semibold">No active promotions</p>
            <p className="mt-2 text-sm" style={{ color: "var(--sf-muted)" }}>There are no live offers on this shop right now.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            <StorefrontPromoCard promo={promotions[0]} featured href={promoHref(base, promotions[0])} />
            {promotions.length > 1 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {promotions.slice(1).map((promo) => (
                  <StorefrontPromoCard key={promo.id} promo={promo} href={promoHref(base, promo)} />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </section>
    </>
  );
}

export function TechContactPage({
  shop,
  config,
}: {
  shop: StorefrontShop;
  config: StorefrontConfig | null;
}) {
  const copy = techCopyFor(shop);
  const image = techHeroImage("contact", shop, config);
  const whatsapp = shopWhatsAppUrl(shop.whatsapp_number || shop.phone, copy.whatsappMessage);
  const hours = parseOpeningHours(shop.opening_hours);
  const scheduled = hasScheduledHours(hours);
  return (
    <>
      <TechHero
        image={image}
        title={copy.contactHero}
        subtitle={`Call, message, or visit ${shop.name}.`}
        objectPosition={techHeroPosition("contact", config)}
      />
      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-6 pt-2 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="sf-panel p-6">
          <h2 className="text-xl font-semibold">Contact information</h2>
          <ul className="mt-5 grid gap-4">
            <li className="flex gap-3">
              <Phone size={18} className="mt-0.5 text-[var(--sf-primary)]" />
              {shop.phone ? <a href={`tel:${shop.phone}`}>{shop.phone}</a> : <span style={{ color: "var(--sf-muted)" }}>Phone not listed</span>}
            </li>
            <li className="flex gap-3">
              <Mail size={18} className="mt-0.5 text-[var(--sf-primary)]" />
              {shop.email ? <a href={`mailto:${shop.email}`}>{shop.email}</a> : <span style={{ color: "var(--sf-muted)" }}>Email not listed</span>}
            </li>
            <li className="flex gap-3">
              <MapPin size={18} className="mt-0.5 text-[var(--sf-primary)]" />
              <span>{shop.address || "Address not listed"}</span>
            </li>
            <li className="flex gap-3">
              <Clock size={18} className="mt-0.5 text-[var(--sf-primary)]" />
              <span>{shop.is_open ? "Open now" : "Closed now"}</span>
            </li>
          </ul>
          {whatsapp ? (
            <a href={whatsapp} className="mt-6 inline-flex min-h-11 items-center bg-[var(--sf-primary)] px-6 text-sm font-semibold text-white">
              WhatsApp
            </a>
          ) : (
            <p className="mt-6 text-sm" style={{ color: "var(--sf-muted)" }}>WhatsApp is not configured for this shop.</p>
          )}
          {scheduled ? (
            <ul className="mt-6 divide-y overflow-hidden rounded-xl border" style={{ borderColor: "color-mix(in srgb, var(--sf-primary) 14%, transparent)" }}>
              {groupedOpeningHours(hours).map((group) => (
                <li key={group.days} className="flex justify-between px-4 py-3 text-sm">
                  <span>
                    {group.days}
                    {group.keys.includes(weekdayKeyNow(hours.timezone)) ? (
                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--sf-primary)]">Today</span>
                    ) : null}
                  </span>
                  <span className="tabular-nums" style={{ color: "var(--sf-muted)" }}>{group.hours}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="sf-panel p-6 sm:p-8">
          <h2 className="text-xl font-semibold">Send a message</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--sf-muted)" }}>The shop receives this as a service request.</p>
          <div className="mt-5">
            <TechContactForm shopId={shop.id} shopName={shop.name} />
          </div>
        </div>
      </section>
      {shop.address ? (
        <div className="mx-auto max-w-6xl px-4 pb-10">
          <StorefrontLocation address={shop.address} shopName={shop.name} phone={shop.phone} email={shop.email} embedded />
        </div>
      ) : (
        <p className="mx-auto max-w-6xl px-4 pb-10 text-sm" style={{ color: "var(--sf-muted)" }}>
          Add a business address in shop settings to show a map here.
        </p>
      )}
    </>
  );
}

export function TechCatalogPage({
  shop,
  title,
  subtitle,
  items,
  empty,
  kind,
}: {
  shop: StorefrontShop;
  title: string;
  subtitle: string;
  items: CatalogItem[];
  empty: string;
  kind: "product" | "service";
}) {
  const pictured = withPhotos(items);
  return (
    <>
      <TechHero
        image={shop.banner_url || DEFAULT_HEROES.home}
        kicker={kind === "product" ? "Catalogue" : "Studio"}
        title={title}
        subtitle={subtitle}
      />
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-2">
        {!items.length ? (
          <p className="sf-panel p-8 text-sm" style={{ color: "var(--sf-muted)" }}>{empty}</p>
        ) : (
          <>
            {pictured.length ? (
              <div className={PRODUCT_GRID_CLASS}>
                {pictured.map((item) => (
                  <PricedProductCard key={item.id} product={item} shop={shop} />
                ))}
              </div>
            ) : null}
            <StorefrontCatalogList title={title} items={items} shop={shop} embedded />
          </>
        )}
      </section>
    </>
  );
}
