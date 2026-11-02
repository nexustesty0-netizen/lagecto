import { loadOwnedShopWithFeatures } from "@/lib/entitlements";
import { PageHeader } from "@/components/ui/primitives";
import { ProfileSettingsForm } from "@/components/settings/ProfileSettingsForm";
import { PasswordChangeForm } from "@/components/settings/PasswordChangeForm";
import { ShopProfileForm } from "@/components/shop/ShopProfileForm";
import { HoursEditor } from "@/components/shop/HoursEditor";
import { ShopStatusCard } from "@/components/shop/ShopStatusCard";
import { FeatureHint } from "@/components/shop/FeatureLocked";
import { NotificationPrefs } from "@/components/notifications/NotificationPrefs";
import { SettingsLayout, SettingsLinkGrid, SettingsPanel } from "@/components/settings/SettingsLayout";
import {
  pickSettingsTab,
  shopCatalogueLinks,
  shopPeopleLinks,
  shopSellingLinks,
  shopSettingTabs,
} from "@/lib/settings-nav";

export default async function ShopSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { profile, shop, subscription } = await loadOwnedShopWithFeatures();
  if (!shop) return null;
  const tabs = shopSettingTabs();
  const { tab } = await searchParams;
  const current = pickSettingsTab(tabs, tab);

  return (
    <>
      <PageHeader title="Shop settings" subtitle={`Shop ID: ${shop.login_shop_id || "Not assigned"}. Cashiers and managers cannot open this page.`} />
      <div className="mb-6">
        <FeatureHint feature="settings" />
      </div>
      <SettingsLayout basePath="/shop/settings" tabs={tabs} current={current}>
        {current === "profile" ? (
          <SettingsPanel title="Shop profile" hint="Business name and description for this shop only.">
            <ShopProfileForm shop={shop} section="profile" />
          </SettingsPanel>
        ) : null}
        {current === "contact" ? (
          <SettingsPanel title="Contact and location" hint="Customers do not pay inside LaGecto. WhatsApp checkout uses the number saved here.">
            <ShopProfileForm shop={shop} section="contact" />
          </SettingsPanel>
        ) : null}
        {current === "hours" ? (
          <SettingsPanel title="Business hours" hint="Opening hours can close the shop automatically when the day ends.">
            <HoursEditor shopId={shop.id} openingHours={shop.opening_hours} autoClose={shop.auto_close} isOpen={shop.is_open} />
          </SettingsPanel>
        ) : null}
        {current === "catalogue" ? (
          <SettingsPanel title="Catalogue" hint="Products, services, and stock stay on their own pages. This shop’s type decides which links appear.">
            <SettingsLinkGrid items={shopCatalogueLinks(shop.provider_type)} />
          </SettingsPanel>
        ) : null}
        {current === "selling" ? (
          <SettingsPanel title="Selling" hint="Logo, till, and receipts already exist as shop tools. Nothing extra is invented here.">
            <SettingsLinkGrid items={shopSellingLinks()} />
          </SettingsPanel>
        ) : null}
        {current === "people" ? (
          <SettingsPanel title="People" hint="Employee roles control who can open the till, inventory, and this settings page.">
            <SettingsLinkGrid items={shopPeopleLinks()} />
          </SettingsPanel>
        ) : null}
        {current === "notifications" ? (
          <SettingsPanel title="Notifications" hint="These alerts play in this browser for the signed-in shop user.">
            <NotificationPrefs />
          </SettingsPanel>
        ) : null}
        {current === "subscription" ? (
          <SettingsPanel title="Subscription" hint="Package prices stay Thabi, Kristen, Sandra, and Free.">
            <ShopStatusCard subscription={subscription} />
          </SettingsPanel>
        ) : null}
        {current === "account" ? (
          <SettingsPanel title="Account security" hint="This is the signed-in owner or shop admin account, not the shop record.">
            <div className="grid gap-6 lg:grid-cols-2">
              <ProfileSettingsForm profile={profile} />
              <PasswordChangeForm />
            </div>
          </SettingsPanel>
        ) : null}
      </SettingsLayout>
    </>
  );
}
