import type { Metadata } from "next";
import Link from "next/link";
import { FoundingUsersBanner } from "@/components/loyalty/FoundingUsersBanner";

export const metadata: Metadata = { title: "For shops" };

export default function ForShopsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <FoundingUsersBanner />
      <h1 className="text-4xl font-semibold">LaGecto for shops</h1>
      <p className="mt-4 text-[#6B7280]">
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
        <Link href="/register-shop" className="rounded-full bg-[#0B6E4F] px-6 py-3 font-semibold text-white">
          Create your shop
        </Link>
        <Link href="/login" className="rounded-full border border-[#0B6E4F] px-6 py-3 font-semibold text-[#0B6E4F]">
          Shop owner login
        </Link>
      </div>
    </article>
  );
}
