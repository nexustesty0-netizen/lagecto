"use client";

import Link from "next/link";
import type { DisplayAd } from "@/lib/ads";

function trackClick(ad: DisplayAd) {
  fetch("/api/marketplace/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventType: "ad_click",
      adId: ad.id,
      shopId: ad.shopId || undefined,
      productId: ad.productId || undefined,
      promotionId: ad.promotionId || undefined,
    }),
    keepalive: true,
  }).catch(() => undefined);
}

export function AdRail({ ads, compact = false }: { ads: DisplayAd[]; compact?: boolean }) {
  if (!ads.length) return null;
  return (
    <div className={`grid gap-2 sm:gap-3 ${compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 md:grid-cols-2"}`}>
      {ads.map((ad) => (
        <Link
          key={ad.id}
          href={ad.href}
          onClick={() => trackClick(ad)}
          className="overflow-hidden rounded-[var(--lg-radius)] bg-white ring-1 ring-[var(--lagecto-border)]"
        >
          {ad.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ad.imageUrl} alt="" className={compact ? "h-36 w-full object-cover" : "h-24 w-full object-cover sm:h-44"} />
          ) : (
            <div className={compact ? "h-16 bg-[#0B6E4F]" : "h-16 bg-[#0B6E4F] sm:h-24"} />
          )}
          <div className="p-2.5 sm:p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0B6E4F] sm:text-xs">{ad.kicker}</p>
            <p className="mt-0.5 line-clamp-1 text-sm font-semibold sm:text-base">{ad.title}</p>
            {ad.body ? <p className="mt-1 hidden text-sm text-[var(--lagecto-muted)] sm:line-clamp-2 sm:block">{ad.body}</p> : null}
          </div>
        </Link>
      ))}
    </div>
  );
}
