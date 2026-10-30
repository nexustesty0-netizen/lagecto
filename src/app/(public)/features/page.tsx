import type { Metadata } from "next";

export const metadata: Metadata = { title: "Features" };

const FEATURES = [
  "Customer shop browsing, cart, WhatsApp checkout, orders and receipts",
  "Shop owner dashboard, products, inventory and POS",
  "Orders, customers, sales, expenses and reports",
  "Financial current period and archives",
  "Receipt view, print, download and WhatsApp share",
  "Shop verification and registration requests",
  "Admin shop creation with unique Shop IDs",
  "Username uniqueness and 14-day change limit",
  "Failed login lock after 5 attempts and admin unlock",
  "Smart Diary journal, tasks and goals",
  "Help Center and FAQ",
  "Role-based access for customer, shop owner and admin",
];

export default function FeaturesPage() {
  return (
    <article className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-4xl font-semibold">Features</h1>
      <p className="mt-3 text-[#6B7280]">These are the LaGecto capabilities available in the web application.</p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <li key={feature} className="lg-card p-4">
            {feature}
          </li>
        ))}
      </ul>
    </article>
  );
}
