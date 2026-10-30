"use client";

import { DIARY_ART, MOTIVATION_QUOTES, quoteForDay } from "@/lib/diary-visuals";
import { DiaryArt } from "@/components/diary/diary-ui";

export function DiaryMotivation() {
  const today = quoteForDay();
  return (
    <div className="grid gap-5">
      <article className="lg-card overflow-hidden p-0 sm:grid sm:grid-cols-[1.2fr_0.8fr]">
        <div className="p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d4af37]">Today</p>
          <p className="mt-3 text-2xl font-semibold leading-snug">“{today.text}”</p>
        </div>
        <div className="p-4">
          <DiaryArt src={today.art} size={280} />
        </div>
      </article>
      <div className="grid gap-3 sm:grid-cols-2">
        {MOTIVATION_QUOTES.map((quote) => (
          <article key={quote.text} className="lg-card diary-rise flex gap-3 p-4">
            <div className="w-16 shrink-0">
              <DiaryArt src={quote.art} size={96} />
            </div>
            <p className="text-sm font-medium leading-6">“{quote.text}”</p>
          </article>
        ))}
      </div>
      <p className="text-center text-xs text-[var(--lagecto-muted)]">These lines are original to LaGecto. No invented authors.</p>
    </div>
  );
}

export const MOTIVATION_HERO = DIARY_ART.motivation;
