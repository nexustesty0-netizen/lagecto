import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Clock, Globe, Mail, MapPin, Phone } from "lucide-react";
import { getProfile } from "@/lib/auth/session";
import { getStorefrontBySlug, getStorefrontExtras } from "@/lib/storefront/load";
import { BookingForm, RequestForm, SaveShopButton } from "@/components/customer/ShopActions";
import { MessageShopButton } from "@/components/chat/MessageShopButton";
import { ReviewForm } from "@/components/customer/ReviewForm";
import { createServerSupabase } from "@/lib/supabase/server";
import { shopWhatsAppUrl } from "@/lib/brand";
import { groupedOpeningHours, parseOpeningHours, weekdayKeyNow, hasScheduledHours } from "@/lib/hours";
import { StorefrontSocialLinks } from "@/components/storefront/StorefrontSocialLinks";
import { StorefrontReviews } from "@/components/storefront/StorefrontReviews";
import { ShareStorefrontButton } from "@/components/storefront/ShareStorefrontButton";
import { StorefrontLocation } from "@/components/storefront/StorefrontLocation";
import { StorefrontPageHeader } from "@/components/storefront/StorefrontPageHeader";
import { isTechStorefront, techPageTitle } from "@/lib/storefront/template";
import { TechContactPage } from "@/components/storefront/tech/TechInnerPages";
import { storefrontOgDescription } from "@/lib/storefront/og";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getStorefrontBySlug(slug);
  if (!data) return { title: "Contact" };
  return {
    title: isTechStorefront(data.shop, data.config) ? techPageTitle(data.shop, "contact") : `Contact ${data.shop.name}`,
    description: storefrontOgDescription({
      name: data.shop.name,
      meta_description: data.shop.meta_description,
      tagline: data.config?.tagline,
      about: data.shop.about,
    }),
  };
}

export default async function StorefrontContactPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getStorefrontBySlug(slug);
  if (!data) notFound();
  const shop = data.shop;
  if (isTechStorefront(shop, data.config)) {
    return <TechContactPage shop={shop} config={data.config} />;
  }
  const extras = await getStorefrontExtras(shop.id);
  const profile = await getProfile();
  const supabase = await createServerSupabase();
  const [{ data: services }, { data: saved }] = await Promise.all([
    supabase.from("products").select("id, name").eq("shop_id", shop.id).eq("type", "service").eq("is_available", true),
    profile ? supabase.from("saved_shops").select("shop_id").eq("user_id", profile.id).eq("shop_id", shop.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const whatsapp = shopWhatsAppUrl(
    shop.whatsapp_number || shop.phone,
    `Hello ${shop.name}, I found you on LaGecto and would like to order.`,
  );
  const hours = parseOpeningHours(shop.opening_hours);
  const scheduled = hasScheduledHours(hours);
  const tiles = [
    { label: "Call", value: shop.phone || "Phone not listed", href: shop.phone ? `tel:${shop.phone}` : undefined, Icon: Phone },
    { label: "Email", value: shop.email || "Email not listed", href: shop.email ? `mailto:${shop.email}` : undefined, Icon: Mail },
    { label: "Find us", value: shop.address || "Address not listed", href: undefined, Icon: MapPin },
    { label: "Hours", value: shop.is_open ? "Open now" : "Closed now", href: undefined, Icon: Clock },
  ];

  return (
    <>
      <StorefrontPageHeader
        kicker="Visit"
        title={`Contact ${shop.name}`}
        subtitle="Call, message, or walk in. This page is the shop’s front desk."
        image={shop.banner_url}
      >
        <div className="flex flex-wrap items-center gap-2">
          <ShareStorefrontButton slug={shop.slug} shopName={shop.name} />
          {profile?.role === "customer" ? <SaveShopButton shopId={shop.id} saved={Boolean(saved)} /> : null}
        </div>
      </StorefrontPageHeader>
      <section className="mx-auto max-w-5xl px-4 pb-16">
        <div className="grid gap-3 sm:grid-cols-2">
          {tiles.map((tile) => (
            <article key={tile.label} className="sf-card sf-reveal flex items-start gap-4 p-5">
              <span className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: "color-mix(in srgb, var(--sf-primary) 12%, transparent)", color: "var(--sf-primary)" }}>
                <tile.Icon size={20} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sf-muted)" }}>
                  {tile.label}
                </p>
                {tile.href ? (
                  <a href={tile.href} className="mt-1 block font-semibold">
                    {tile.value}
                  </a>
                ) : (
                  <p className="mt-1 font-semibold">{tile.value}</p>
                )}
              </div>
            </article>
          ))}
        </div>

        <div className="sf-card sf-reveal mt-6 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="sf-kicker">Talk to us</p>
            <p className="mt-2 text-lg font-semibold">Message the shop or send WhatsApp</p>
            <StorefrontSocialLinks shop={shop} className="mt-4" />
          </div>
          <div className="flex flex-col gap-2 sm:min-w-[14rem]">
            {profile?.role === "shop_owner" || profile?.role === "admin" ? null : (
            <MessageShopButton
              shopId={shop.id}
              shopName={shop.name}
              loggedIn={profile?.role === "customer"}
              nextPath={`/s/${slug}/contact`}
            />
            )}
            {whatsapp ? (
              <a href={whatsapp} className="sf-btn text-center">
                WhatsApp {shop.name}
              </a>
            ) : null}
            {shop.website_url ? (
              <a href={shop.website_url} target="_blank" rel="noreferrer" className="sf-btn-ghost inline-flex items-center gap-2 text-sm">
                <Globe size={16} /> Website
              </a>
            ) : null}
          </div>
        </div>

        <StorefrontLocation address={shop.address} shopName={shop.name} phone={shop.phone} email={shop.email} embedded />

        {scheduled ? (
          <div className="sf-card sf-reveal mt-6 overflow-hidden">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b px-6 py-5" style={{ borderColor: "color-mix(in srgb, var(--sf-text) 8%, transparent)" }}>
              <div>
                <p className="sf-kicker">Business hours</p>
                <h2 className="mt-2 text-2xl font-semibold">When we’re open</h2>
              </div>
              <p className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]" style={{ background: shop.is_open ? "color-mix(in srgb, var(--sf-primary) 14%, transparent)" : "color-mix(in srgb, var(--sf-text) 8%, transparent)", color: shop.is_open ? "var(--sf-primary)" : "var(--sf-muted)" }}>
                {shop.is_open ? "Open now" : "Closed now"}
              </p>
            </div>
            <ul className="divide-y px-2 py-2 sm:px-4" style={{ borderColor: "color-mix(in srgb, var(--sf-text) 8%, transparent)" }}>
              {groupedOpeningHours(hours).map((group) => {
                const today = weekdayKeyNow(hours.timezone);
                const isToday = group.keys.includes(today);
                return (
                  <li
                    key={group.days}
                    className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-xl px-4 py-3.5 text-sm"
                    style={isToday ? { background: "color-mix(in srgb, var(--sf-primary) 10%, transparent)" } : undefined}
                  >
                    <span className="font-medium">
                      {group.days}
                      {isToday ? <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--sf-primary)" }}>Today</span> : null}
                    </span>
                    <span className="tabular-nums" style={{ color: group.closed ? "var(--sf-muted)" : "var(--sf-text)" }}>
                      {group.hours}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="px-6 pb-5 text-sm" style={{ color: "var(--sf-muted)" }}>
              {shop.is_pickup_only ? "Pickup only." : shop.delivery_time || "Ask the shop about delivery."}
            </p>
          </div>
        ) : null}

        <p className="mt-6 text-sm" style={{ color: "var(--sf-muted)" }}>
          Add items to your cart, then checkout via WhatsApp. You can order without an account if you add your name. Payment is arranged directly with this shop.
        </p>

        {profile?.role === "customer" && shop.provider_type !== "products" ? (
          <div className="sf-card mt-8 p-6">
            <h2 className="text-xl font-semibold">Book a service</h2>
            <BookingForm shopId={shop.id} services={services || []} />
            <h2 className="mt-8 text-xl font-semibold">Custom request</h2>
            <RequestForm shopId={shop.id} />
          </div>
        ) : (
          <p className="mt-6 text-sm" style={{ color: "var(--sf-muted)" }}>
            Sign in if you want in-app bookings or custom requests. Ordering and reviews do not need an account.
          </p>
        )}

        <div className="sf-card mt-8 p-6">
          <h2 className="text-xl font-semibold">Leave a review</h2>
          <p className="mt-1 mb-3 text-sm" style={{ color: "var(--sf-muted)" }}>
            Add your name or business name. Reviews appear on this storefront. The shop can hide or delete them.
          </p>
          <ReviewForm shopId={shop.id} defaultName={profile?.name || ""} />
        </div>
        <div className="mt-8">
          <StorefrontReviews reviews={extras.reviews} embedded />
        </div>
        <p className="mt-8 text-xs" style={{ color: "var(--sf-muted)" }}>
          <Link href={`/support/report-shop?shop=${shop.id}`} className="underline-offset-2 hover:underline">
            Report this shop
          </Link>
          {" · "}Help keep LaGecto safe. Only report a shop if you believe there is a genuine problem.
        </p>
      </section>
    </>
  );
}
