import Link from "next/link";
import { loadOwnedShopWithFeatures } from "@/lib/entitlements";
import { PageHeader } from "@/components/ui/primitives";
import { ProfileSettingsForm } from "@/components/settings/ProfileSettingsForm";
import { ShopProfileForm } from "@/components/shop/ShopProfileForm";
import { HoursEditor } from "@/components/shop/HoursEditor";
import { ShopStatusCard } from "@/components/shop/ShopStatusCard";
import { FeatureHint } from "@/components/shop/FeatureLocked";
import { NotificationPrefs } from "@/components/notifications/NotificationCenter";

const HUB = [
  { href: "/shop/storefront", title: "Storefront", hint: "Logo, cover, colors, and mini-website" },
  { href: "/shop/products", title: "Products", hint: "Catalogue, prices, and visibility" },
  { href: "/shop/services", title: "Services", hint: "Offerings and availability" },
  { href: "/shop/pos", title: "POS", hint: "Included on Free" },
  { href: "/shop/quotations", title: "Quotations", hint: "Estimates and proposals" },
  { href: "/shop/receipts/settings", title: "Receipt design", hint: "Templates and shop branding" },
  { href: "/shop/inventory", title: "Inventory", hint: "Included on Free" },
  { href: "/shop/promotions", title: "Promotions", hint: "Included on Free" },
  { href: "/shop/subscription", title: "Subscription", hint: "Packages" },
];

export default async function ShopSettingsPage() {
  const { profile, shop, subscription } = await loadOwnedShopWithFeatures();
  if (!shop) return null;
  return (
    <>
      <PageHeader title="Settings" subtitle={`Shop ID: ${shop.login_shop_id || "Not assigned"}`} />
      <div className="mb-6">
        <FeatureHint feature="settings" />
      </div>
      <div className="mb-6">
        <ShopStatusCard subscription={subscription} />
      </div>
      <div className="mb-6">
        <NotificationPrefs />
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {HUB.map((item) => (
          <Link key={item.href} href={item.href} className="lg-card p-4">
            <p className="font-semibold">{item.title}</p>
            <p className="mt-1 text-sm text-[var(--lagecto-muted)]">{item.hint}</p>
          </Link>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ShopProfileForm shop={shop} />
        <HoursEditor shopId={shop.id} openingHours={shop.opening_hours} autoClose={shop.auto_close} isOpen={shop.is_open} />
        <article className="lg-card grid gap-2 p-5">
          <h2 className="font-semibold">Checkout via WhatsApp</h2>
          <p className="text-sm text-[#6B7280]">
            Customers do not pay inside LaGecto. Add your WhatsApp number in Shop profile so checkout can open a chat
            with your order details. Payment is arranged directly with you.
          </p>
        </article>
        <ProfileSettingsForm profile={profile} />
      </div>
    </>
  );
}
