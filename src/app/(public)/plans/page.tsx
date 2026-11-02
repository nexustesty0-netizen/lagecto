import type { Metadata } from "next";
import { Check } from "lucide-react";
import { PublicHero } from "@/components/public/PublicHero";
import { FREE_PLAN_HIGHLIGHTS, PACKAGE_META, PACKAGE_THEME } from "@/lib/packages";
import { loadLivePackagePrices } from "@/lib/packages.server";
import { PackagePicker } from "@/components/shop/PackagePicker";
import { MARKETPLACE_IMAGES } from "@/lib/public-catalog";

export const metadata: Metadata = {
  title: "Plans",
  description: "Free, Thabi, Kristen and Sandra shop packages. Every shop starts on Free. Paid plans are requested on WhatsApp and activated by LaGecto.",
};

const STEPS = [
  { n: "1", title: "Start free", body: "Open a shop and use every tool while you get going." },
  { n: "2", title: "Pick a package", body: "Choose Thabi, Kristen or Sandra and a duration." },
  { n: "3", title: "Request it", body: "Message LaGecto on WhatsApp. An admin activates the plan after payment." },
];

export default async function PublicPlansPage() {
  const prices = await loadLivePackagePrices();
  const free = PACKAGE_THEME.free;
  return (
    <>
      <PublicHero
        kicker="Plans"
        title="Shop packages"
        subtitle="Every shop starts on Free. Paid packages add a verified badge. Choose a duration to see the price, then request the plan from LaGecto."
        image={MARKETPLACE_IMAGES.plansHero}
      />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <div className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((step) => (
            <article key={step.n} className="rounded-[var(--lg-radius)] border border-[var(--lagecto-border)] bg-white p-4">
              <p className="grid h-8 w-8 place-items-center rounded-full bg-[#0B6E4F] text-sm font-semibold text-white">{step.n}</p>
              <h2 className="mt-3 font-semibold">{step.title}</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--lagecto-muted)]">{step.body}</p>
            </article>
          ))}
        </div>

        <article className="mt-8 overflow-hidden rounded-[var(--lg-radius)] border border-[var(--lagecto-border)] bg-white">
          <div className="h-1.5" style={{ background: free.accent }} />
          <div className="grid gap-5 p-5 sm:grid-cols-[1fr_1.2fr] sm:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--lagecto-muted)]">Always included</p>
              <h2 className="mt-2 text-2xl font-semibold">{PACKAGE_META.free.name}</h2>
              <p className="mt-2 text-3xl font-semibold text-[#0B6E4F]">$0</p>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[#6B7280]">{PACKAGE_META.free.description}</p>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {FREE_PLAN_HIGHLIGHTS.map((item) => (
                <li key={item} className="flex items-start gap-2 rounded-2xl px-3 py-2 text-sm" style={{ background: free.wash }}>
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white text-[#0B6E4F]">
                    <Check size={12} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </article>

        <div className="mt-10 min-w-0">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Paid packages</h2>
            <p className="mt-1 text-sm text-[var(--lagecto-muted)]">Thabi, Kristen and Sandra. Pick a duration, then request the one you want.</p>
          </div>
          <PackagePicker requestHref prices={prices} />
        </div>
      </div>
    </>
  );
}
