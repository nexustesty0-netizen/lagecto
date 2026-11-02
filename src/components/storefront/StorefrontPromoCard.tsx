"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { money } from "@/lib/format";
import { MediaPreview } from "@/components/media/MediaPreview";

export type StorefrontPromo = {
  id: string;
  title: string;
  description?: string | null;
  image?: string | null;
  discount?: number | null;
  promo_price?: number | null;
  original_price?: number | null;
  ends_at?: string | null;
  expiry_date?: string | null;
  product_id?: string | null;
};

function offerLabel(promo: StorefrontPromo) {
  if (promo.original_price != null && promo.promo_price != null) {
    return { main: money(promo.promo_price), was: money(promo.original_price), tag: null as string | null };
  }
  if (promo.discount != null) return { main: `${promo.discount}% off`, was: null, tag: "Sale" };
  return { main: "Special offer", was: null, tag: "Offer" };
}

function PromoEndsIn({ endsAt }: { endsAt: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const ms = new Date(endsAt).getTime() - now;
  if (Number.isNaN(ms) || ms <= 0) return <span>Offer ending soon</span>;
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span>
      {days > 0 ? `${days}d ` : ""}
      {pad(hours)}:{pad(minutes)}:{pad(seconds)} left
    </span>
  );
}

export function promoHref(base: string, promo: Pick<StorefrontPromo, "product_id">) {
  return promo.product_id ? `${base}/p/${promo.product_id}` : `${base}/promotions`;
}

export function StorefrontPromoCard({
  promo,
  featured = false,
  href,
}: {
  promo: StorefrontPromo;
  featured?: boolean;
  href?: string;
}) {
  const offer = offerLabel(promo);
  const ends = promo.ends_at || (promo.expiry_date ? `${promo.expiry_date}T23:59:59` : null);
  return (
    <article
      className={`sf-card sf-hover-card relative overflow-hidden ${featured ? "md:grid md:grid-cols-2" : ""}`}
    >
      <div className={`relative overflow-hidden ${featured ? "min-h-[240px]" : "h-48"}`}>
        {promo.image ? (
          <MediaPreview url={promo.image} title={promo.title} className="absolute inset-0 h-full w-full" fit="cover" />
        ) : (
          <div className="sf-shimmer absolute inset-0 opacity-80" />
        )}
        <span className="sf-live absolute left-4 top-4">Live</span>
        {offer.tag ? (
          <span className="absolute right-4 top-4 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold" style={{ color: "var(--sf-primary)" }}>
            {offer.tag}
          </span>
        ) : null}
      </div>
      <div className={`relative flex flex-col justify-center p-5 ${featured ? "sm:p-8" : ""}`}>
        <p className="sf-kicker">Promotion</p>
        <h2 className={`mt-2 font-semibold ${featured ? "text-3xl" : "text-xl"}`}>{promo.title}</h2>
        {promo.description ? (
          <p className="mt-3 text-sm leading-6" style={{ color: "var(--sf-muted)" }}>
            {promo.description}
          </p>
        ) : null}
        <p className="mt-3 text-2xl font-semibold" style={{ color: "var(--sf-primary)" }}>
          {offer.main}
          {offer.was ? (
            <span className="ml-2 text-base font-normal line-through" style={{ color: "var(--sf-muted)" }}>
              {offer.was}
            </span>
          ) : null}
        </p>
        <p className="mt-2 text-sm" style={{ color: "var(--sf-muted)" }}>
          {ends ? <PromoEndsIn endsAt={ends} /> : "While stocks last"}
        </p>
        {href ? (
          <Link href={href} className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold" style={{ color: "var(--sf-primary)" }}>
            View promotion
          </Link>
        ) : null}
      </div>
    </article>
  );
}
