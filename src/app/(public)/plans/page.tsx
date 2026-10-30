import type { Metadata } from "next";
import Image from "next/image";
import { FREE_PLAN_HIGHLIGHTS, PACKAGE_META } from "@/lib/packages";
import { PackagePicker } from "@/components/shop/PackagePicker";
import { MARKETPLACE_IMAGES } from "@/lib/public-catalog";

export const metadata: Metadata = { title: "Plans" };

export default function PublicPlansPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image src={MARKETPLACE_IMAGES.plansHero} alt="" fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#073628]/88 via-[#0B6E4F]/55 to-[#073628]/20" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-16 text-white lg:py-24">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#d4af37]">Plans</p>
          <h1 className="mt-4 max-w-xl text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl lg:text-5xl">Shop packages</h1>
          <p className="mt-4 max-w-2xl text-base text-white/85">
            Every shop starts on Free. For now unpaid shops include every tool. Paid packages add a verified badge. Choose a
            duration to see the price, then request the plan from LaGecto.
          </p>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <article className="lg-card min-w-0 overflow-hidden p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6B7280]">Always included</p>
          <h2 className="mt-2 text-2xl font-semibold">{PACKAGE_META.free.name}</h2>
          <p className="mt-2 text-3xl font-semibold text-[#0B6E4F]">$0</p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6B7280]">{PACKAGE_META.free.description}</p>
          <p className="mt-4 text-sm text-[#0B6E4F]">
            POS, inventory, storefront, staff, receipts, analytics, and every other shop tool are included on Free for now.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {FREE_PLAN_HIGHLIGHTS.map((item) => (
              <li key={item} className="rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm">
                {item}
              </li>
            ))}
          </ul>
        </article>
        <div className="mt-10 min-w-0">
          <h2 className="mb-4 text-xl font-semibold">Paid packages</h2>
          <PackagePicker requestHref />
        </div>
      </div>
    </>
  );
}
