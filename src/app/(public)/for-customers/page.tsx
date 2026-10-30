import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "For customers" };

export default function ForCustomersPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-semibold">LaGecto for customers</h1>
      <p className="mt-4 text-[#6B7280]">
        Discover local shops, order products or services, checkout via WhatsApp, track orders, keep receipts, write reviews, and use Smart Diary.
      </p>
      <ul className="mt-8 grid gap-3">
        {["Explore shops and products", "Shopping cart and WhatsApp checkout", "Order tracking", "Digital receipts", "Reviews", "Notifications", "Profile and settings", "Smart Diary"].map((item) => (
          <li key={item} className="rounded-2xl bg-white p-4">
            {item}
          </li>
        ))}
      </ul>
      <Link href="/signup" className="mt-8 inline-block rounded-full bg-[#0B6E4F] px-6 py-3 font-semibold text-white">
        Create a customer account
      </Link>
    </article>
  );
}
