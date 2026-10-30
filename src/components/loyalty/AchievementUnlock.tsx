"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Unlock = { id: string; name: string; description?: string; rarity?: string };

export function AchievementUnlock({ items }: { items?: Unlock[] | null }) {
  const [current, setCurrent] = useState<Unlock | null>(null);

  useEffect(() => {
    if (!items?.length || typeof window === "undefined") return;
    const seen = new Set(JSON.parse(window.sessionStorage.getItem("lg-badge-seen") || "[]") as string[]);
    const fresh = items.find((item) => !seen.has(item.id));
    if (!fresh) return;
    seen.add(fresh.id);
    window.sessionStorage.setItem("lg-badge-seen", JSON.stringify([...seen].slice(-40)));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setCurrent(fresh), reduce ? 0 : 240);
    return () => window.clearTimeout(timer);
  }, [items]);

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#12241c]/45 p-4" role="dialog" aria-labelledby="achievement-title" aria-modal="true">
      <div className="lg-card max-w-md p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D4AF37]">Achievement unlocked</p>
        <h2 id="achievement-title" className="mt-3 text-2xl font-semibold">
          {current.name}
        </h2>
        {current.description ? <p className="mt-2 text-sm text-[var(--lagecto-muted)]">{current.description}</p> : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/customer/badges" className="rounded-full bg-[#0B6E4F] px-5 py-2 text-sm font-semibold text-white">
            View achievement
          </Link>
          <button type="button" className="rounded-full border px-5 py-2 text-sm" onClick={() => setCurrent(null)}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
