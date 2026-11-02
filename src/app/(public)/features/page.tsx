import type { Metadata } from "next";
import { PublicHero } from "@/components/public/PublicHero";
import { MARKETPLACE_IMAGES } from "@/lib/public-catalog";

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
    <article>
      <PublicHero
        kicker="Product"
        title="Features"
        subtitle="These are the LaGecto capabilities available in the web application."
        image={MARKETPLACE_IMAGES.supportHero}
      />
      <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
        <ul className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <li key={feature} className="lg-card p-4">
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
