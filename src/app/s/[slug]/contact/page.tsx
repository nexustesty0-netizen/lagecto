import { notFound } from "next/navigation";
import Link from "next/link";
import { getProfile } from "@/lib/auth/session";
import { getStorefrontBySlug, getStorefrontExtras } from "@/lib/storefront/load";
import { BookingForm, RequestForm, SaveShopButton } from "@/components/customer/ShopActions";
import { MessageShopButton } from "@/components/chat/MessageShopButton";
import { ReviewForm } from "@/components/customer/ReviewForm";
import { createServerSupabase } from "@/lib/supabase/server";
import { shopWhatsAppUrl } from "@/lib/brand";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";
import { formatDayHours, parseOpeningHours, WEEKDAYS, hasScheduledHours } from "@/lib/hours";
import { StorefrontSocialLinks } from "@/components/storefront/StorefrontSocialLinks";
import { StorefrontReviews } from "@/components/storefront/StorefrontReviews";
import { ShareStorefrontButton } from "@/components/storefront/ShareStorefrontButton";

export default async function StorefrontContactPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getStorefrontBySlug(slug);
  if (!data) notFound();
  const shop = data.shop;
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
  return (
    <section className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold">Contact</h1>
            <VerifiedBadge verified={shop.verified} />
          </div>
          <p className="mt-2" style={{ color: "var(--sf-muted)" }}>{shop.address || "Address not listed"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ShareStorefrontButton slug={shop.slug} shopName={shop.name} />
          {profile?.role === "customer" ? <SaveShopButton shopId={shop.id} saved={Boolean(saved)} /> : null}
        </div>
      </div>
      <div className="mt-4">
        <MessageShopButton shopId={shop.id} shopName={shop.name} loggedIn={profile?.role === "customer"} />
      </div>
      <StorefrontSocialLinks shop={shop} className="mt-4" />
      <div className="sf-card mt-6 grid gap-2 p-5 text-sm">
        <p>{shop.phone || "Phone not listed"}</p>
        <p>{shop.email || "Email not listed"}</p>
        {shop.website_url ? (
          <a href={shop.website_url} target="_blank" rel="noreferrer" className="font-medium">
            {shop.website_url}
          </a>
        ) : null}
        <p>{shop.is_pickup_only ? "Pickup only" : shop.delivery_time || "Shop hours"}</p>
        <p>Status: {shop.is_open ? "Open now" : "Closed now"}</p>
        {(() => {
          const hours = parseOpeningHours(shop.opening_hours);
          if (!hasScheduledHours(hours)) return null;
          return (
          <ul className="mt-3 grid gap-1">
            {WEEKDAYS.map((day) => (
              <li key={day.key} className="flex justify-between gap-4">
                <span>{day.label}</span>
                <span>{formatDayHours(hours.days[day.key])}</span>
              </li>
            ))}
          </ul>
          );
        })()}
        {whatsapp ? (
          <a href={whatsapp} className="sf-btn mt-3 text-center">
            Message {shop.name}
          </a>
        ) : null}
      </div>
      <p className="mt-4 text-sm" style={{ color: "var(--sf-muted)" }}>
        Add items to your cart, then checkout via WhatsApp. You can order without an account if you add your name. Payment is arranged directly with this shop.
      </p>
      <p className="mt-8 text-xs" style={{ color: "var(--sf-muted)" }}>
        <Link href={`/support/report-shop?shop=${shop.id}`} className="underline-offset-2 hover:underline">
          Report this shop
        </Link>
        {" · "}Help keep LaGecto safe. Only report a shop if you believe there is a genuine problem.
      </p>
      {profile?.role === "customer" && shop.provider_type !== "products" ? (
        <div className="mt-8">
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
      <div className="mt-8">
        <h2 className="text-xl font-semibold">Leave a review</h2>
        <p className="mt-1 mb-3 text-sm" style={{ color: "var(--sf-muted)" }}>
          Add your name or business name. Reviews appear on this storefront. The shop can hide or delete them.
        </p>
        <ReviewForm shopId={shop.id} defaultName={profile?.name || ""} />
      </div>
      <div className="mt-8">
        <StorefrontReviews reviews={extras.reviews} embedded />
      </div>
    </section>
  );
}
