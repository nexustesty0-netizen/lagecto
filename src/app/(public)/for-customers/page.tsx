import type { Metadata } from "next";
import Link from "next/link";
import { PublicHero } from "@/components/public/PublicHero";
import { MARKETPLACE_IMAGES } from "@/lib/public-catalog";

export const metadata: Metadata = { title: "For customers" };

export default function ForCustomersPage() {
  return (
    <article>
      <PublicHero
        kicker="Customers"
        title="LaGecto for customers"
        subtitle="Discover local shops, order on WhatsApp, keep receipts, and write reviews."
        image={MARKETPLACE_IMAGES.shopsHero}
      />
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <ul className="grid gap-3">
          {["Explore shops and products", "Shopping cart and WhatsApp checkout", "Order tracking", "Digital receipts", "Reviews", "Notifications", "Profile and settings", "Smart Diary"].map((item) => (
            <li key={item} className="rounded-2xl bg-white p-4">
              {item}
            </li>
          ))}
        </ul>
        <Link href="/signup" className="lg-btn mt-8">
          Create a customer account
        </Link>
      </div>
    </article>
  );
}
