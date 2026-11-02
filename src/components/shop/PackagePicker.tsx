"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { money } from "@/lib/format";
import {
  DURATION_KEYS,
  DURATION_LABELS,
  PACKAGE_CARD_POINTS,
  PACKAGE_META,
  PACKAGE_PRICES,
  PACKAGE_THEME,
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
  prices = PACKAGE_PRICES,
}: {
  shopName?: string;
  currentPackage?: string;
  requestHref?: boolean;
  prices?: Record<PaidPackageKey, Record<DurationKey, number>>;
}) {
  const [duration, setDuration] = useState<DurationKey>("6_months");

  const cards = useMemo(
    () =>
      PAID_PACKAGE_KEYS.map((key) => ({
        key,
        meta: PACKAGE_META[key],
        theme: PACKAGE_THEME[key],
        points: PACKAGE_CARD_POINTS[key],
        price: prices[key]?.[duration] ?? PACKAGE_PRICES[key][duration],
        highlight: HIGHLIGHT[key],
      })),
    [duration, prices],
  );

  return (
    <div className="grid gap-5">
      <div className="rounded-[var(--lg-radius)] border border-[var(--lagecto-border)] bg-white p-2">
        <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--lagecto-muted)]">Choose duration</p>
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          {DURATION_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setDuration(key)}
              className={`min-h-11 shrink-0 rounded-full px-4 py-2 text-sm font-medium ${duration === key ? "bg-[#0B6E4F] text-white" : "border bg-white"}`}
            >
              {DURATION_LABELS[key]}
            </button>
          ))}
        </div>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const href = shopWhatsAppUrl(
            CONTACT.phoneTel,
            `Hello LaGecto, I want the ${card.meta.name} package for ${DURATION_LABELS[duration]} (${money(card.price)}) for ${shopName || "my shop"}.`,
          );
          const current = currentPackage === card.key;
          return (
            <article
              key={card.key}
              className={`relative flex min-w-0 flex-col overflow-hidden rounded-[var(--lg-radius)] border bg-white ${current ? "ring-2 ring-[#0B6E4F]" : "border-[var(--lagecto-border)]"}`}
            >
              <div className="h-1.5" style={{ background: card.theme.accent }} />
              <div className="flex flex-1 flex-col p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: card.theme.ink }}>
                    {card.highlight || card.meta.tagline}
                  </p>
                  {current ? <span className="badge bg-[#0B6E4F] text-white">Current</span> : null}
                </div>
                <h2 className="mt-2 text-2xl font-semibold">{card.meta.name}</h2>
                <p className="mt-2 break-words text-3xl font-semibold" style={{ color: card.theme.accent }}>
                  {money(card.price)}
                </p>
                <p className="text-sm text-[var(--lagecto-muted)]">for {DURATION_LABELS[duration]}</p>
                <p className="mt-3 text-sm leading-6 text-[var(--lagecto-muted)]">{card.meta.description}</p>
                <ul className="mt-4 grid gap-2">
                  {card.points.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full" style={{ background: card.theme.wash, color: card.theme.accent }}>
                        <Check size={12} />
                      </span>
                      {point}
                    </li>
                  ))}
                </ul>
                {requestHref && href ? (
                  <a
                    href={href}
                    className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white"
                    style={{ background: card.theme.accent }}
                  >
                    Request {card.meta.name}
                  </a>
                ) : (
                  <div className="mt-5" />
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
