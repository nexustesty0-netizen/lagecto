"use client";

import Link from "next/link";
import { DIARY_ART } from "@/lib/diary-visuals";
import { DiaryArt } from "@/components/diary/diary-ui";

export function DiaryBusiness({ basePath }: { basePath: string }) {
  const cards = [
    { href: `${basePath}/goals`, title: "Business Goals", body: "Targets for the shop and the work ahead.", art: DIARY_ART.goals },
    { href: `${basePath}/journal`, title: "Business Notes", body: "Meeting notes, lessons, and daily records.", art: DIARY_ART.journal },
    { href: `${basePath}/vision`, title: "Ideas", body: "Catch the next product, offer, or partnership.", art: DIARY_ART.growth },
    { href: `${basePath}/tasks`, title: "Business Tasks", body: "The work that moves the shop this week.", art: DIARY_ART.tasks },
    { href: `${basePath}/calendar`, title: "Business Events", body: "Deliveries, meetings, and important dates.", art: DIARY_ART.calendar },
    { href: `${basePath}/chat`, title: "Ask Stebo", body: "Plan the day without leaving the diary.", art: DIARY_ART.stebo },
  ];

  return (
    <div className="grid gap-5">
      <section className="lg-card flex items-center gap-4 overflow-hidden p-5">
        <div className="w-24 shrink-0">
          <DiaryArt src={DIARY_ART.business} size={160} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d4af37]">Business diary</p>
          <h2 className="mt-1 text-2xl font-semibold">Work notes, kept private</h2>
          <p className="mt-1 text-sm text-[var(--lagecto-muted)]">
            Same diary, professional lens. Goals, ideas, tasks and events stay on your account.
          </p>
        </div>
      </section>
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="lg-card flex items-center gap-4 p-4 transition hover:-translate-y-0.5">
            <div className="w-16 shrink-0">
              <DiaryArt src={card.art} size={96} />
            </div>
            <div>
              <p className="font-semibold">{card.title}</p>
              <p className="text-sm text-[var(--lagecto-muted)]">{card.body}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
