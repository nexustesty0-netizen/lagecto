import type { Metadata } from "next";
import Link from "next/link";
import { FoundingUsersBanner } from "@/components/loyalty/FoundingUsersBanner";
import { PublicHero } from "@/components/public/PublicHero";
import { MARKETPLACE_IMAGES } from "@/lib/public-catalog";

export const metadata: Metadata = { title: "For shops" };

export default function ForShopsPage() {
  return (
    <article>
      <PublicHero
        kicker="Shops"
        title="LaGecto for shops"
        subtitle="Create your shop, get a Shop ID, and start on Free. Customers check out with you on WhatsApp."
        image={MARKETPLACE_IMAGES.plansHero}
      />
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <FoundingUsersBanner />
        <p className="text-[#6B7280]">
          Create your shop from Register a shop and you get a Shop ID such as gectotech@lg23. Sign in with that ID. You start on
          Free — for now every shop tool is included. Marketplace customers check out on WhatsApp using the number in your shop
          profile.
        </p>
        <ul className="mt-8 grid gap-3">
          {[
            "Dashboard",
            "Products and inventory",
            "Point of sale",
            "Orders and WhatsApp checkout",
            "Promotions",
            "Customer loyalty",
            "Sales, expenses and reports",
            "Financial current period and archives",
            "Receipts",
            "Shop profile, verification and settings",
          ].map((item) => (
            <li key={item} className="rounded-2xl bg-white p-4">
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/register-shop" className="lg-btn">
            Create your shop
          </Link>
          <Link href="/login" className="lg-btn-secondary">
            Shop owner login
          </Link>
        </div>
      </div>
    </article>
  );
}
