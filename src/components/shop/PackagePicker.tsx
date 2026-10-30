"use client";

import { useMemo, useState } from "react";
import { money } from "@/lib/format";
import {
  DURATION_KEYS,
  DURATION_LABELS,
  PACKAGE_META,
  PACKAGE_PRICES,
  PAID_PACKAGE_KEYS,
  type DurationKey,
  type PaidPackageKey,
} from "@/lib/packages";
import { shopWhatsAppUrl } from "@/lib/brand";
import { CONTACT } from "@/lib/brand";

const HIGHLIGHT: Partial<Record<PaidPackageKey, string>> = {
  kristen: "Most popular",
  sandra: "Best value",
};

export function PackagePicker({
  shopName,
  currentPackage,
  requestHref,
}: {
  shopName?: string;
  currentPackage?: string;
  requestHref?: boolean;
}) {
  const [duration, setDuration] = useState<DurationKey>("6_months");

  const cards = useMemo(
    () =>
      PAID_PACKAGE_KEYS.map((key) => ({
        key,
        meta: PACKAGE_META[key],
        price: PACKAGE_PRICES[key][duration],
        highlight: HIGHLIGHT[key],
      })),
    [duration],
  );

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap gap-2">
        {DURATION_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setDuration(key)}
            className={`min-h-11 rounded-full px-4 py-2 text-sm font-medium ${duration === key ? "bg-[#0B6E4F] text-white" : "border bg-white"}`}
          >
            {DURATION_LABELS[key]}
          </button>
        ))}
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const href = shopWhatsAppUrl(
            CONTACT.phoneTel,
            `Hello LaGecto, I want the ${card.meta.name} package for ${DURATION_LABELS[duration]} (${money(card.price)}) for ${shopName || "my shop"}.`,
          );
          return (
            <article
              key={card.key}
              className={`lg-card relative flex min-w-0 flex-col overflow-hidden p-5 sm:p-6 ${currentPackage === card.key ? "ring-2 ring-[#0B6E4F]" : ""}`}
            >
              {card.highlight ? (
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">{card.highlight}</p>
              ) : (
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6B7280]">{card.meta.tagline}</p>
              )}
              <h2 className="mt-2 text-2xl font-semibold">{card.meta.name}</h2>
              <p className="mt-2 break-words text-3xl font-semibold text-[#0B6E4F]">{money(card.price)}</p>
              <p className="text-sm text-[var(--lagecto-muted)]">for {DURATION_LABELS[duration]}</p>
              <p className="mt-3 flex-1 text-sm leading-6 text-[var(--lagecto-muted)]">{card.meta.description}</p>
              {requestHref && href ? (
                <a href={href} className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#0B6E4F] px-4 py-2 text-sm font-semibold text-white">
                  Request {card.meta.name}
                </a>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
