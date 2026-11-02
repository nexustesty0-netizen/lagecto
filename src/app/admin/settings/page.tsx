import { requireAdminLevel } from "@/lib/auth/session";
import { canManagePlatformSettings } from "@/lib/admin-access";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/primitives";
import { ProfileSettingsForm } from "@/components/settings/ProfileSettingsForm";
import { PasswordChangeForm } from "@/components/settings/PasswordChangeForm";
import { CONTACT } from "@/lib/brand";
import { AdminPaymentConfigForm } from "@/components/admin/AdminPaymentConfigForm";
import { SelfServeShopToggle } from "@/components/admin/SelfServeShopToggle";
import { getPaymentPublicConfig } from "@/lib/payments/config";
import { selfServeShopPortal } from "@/lib/platform-flags.server";
import type { PaymentMethod } from "@/lib/payments/methods";
import { SettingsLayout, SettingsLinkGrid, SettingsPanel } from "@/components/settings/SettingsLayout";
import { adminSettingsLinks, adminSettingTabs, pickSettingsTab } from "@/lib/settings-nav";
import { NotificationPrefs } from "@/components/notifications/NotificationPrefs";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const profile = await requireAdminLevel("admin");
  const superAdmin = canManagePlatformSettings(profile);
  const tabs = adminSettingTabs(superAdmin);
  const { tab } = await searchParams;
  const current = pickSettingsTab(tabs, tab);
  const links = adminSettingsLinks(superAdmin);
  const supabase = await createServerSupabase();
  const [{ data }, selfServe] = await Promise.all([
    supabase.from("platform_payment_config").select("enabled_methods").eq("id", 1).maybeSingle(),
    selfServeShopPortal(),
  ]);
  const config = getPaymentPublicConfig();

  return (
    <>
      <PageHeader title="Settings" subtitle="Each category only shows tools this admin role can change." />
      <SettingsLayout basePath="/admin/settings" tabs={tabs} current={current}>
        {current === "profile" ? (
          <SettingsPanel title="Profile" hint="Your admin account. Role and admin level cannot be changed here.">
            <div className="grid gap-6 lg:grid-cols-2">
              <ProfileSettingsForm profile={profile} />
              <PasswordChangeForm />
            </div>
          </SettingsPanel>
        ) : null}
        {current === "platform" && superAdmin ? (
          <SettingsPanel title="Platform" hint="Self-serve shop registration and which payment methods LaGecto can show. This is not a new payment gateway.">
            <SelfServeShopToggle enabled={selfServe.open} used={selfServe.used} limit={selfServe.limit} />
            <AdminPaymentConfigForm
              enabledMethods={(data?.enabled_methods as PaymentMethod[]) || ["visa", "mastercard", "ecocash", "cash"]}
              provider={config.provider}
              mode={config.mode}
              paynowConfigured={config.paynowConfigured}
            />
          </SettingsPanel>
        ) : null}
        {current === "branding" && superAdmin ? (
          <SettingsPanel title="Branding" hint="Public company identity stays on the Company page.">
            <SettingsLinkGrid items={links.branding} />
          </SettingsPanel>
        ) : null}
        {current === "support" ? (
          <SettingsPanel title="Support information" hint="These are the published LaGecto support contacts.">
            <div className="lg-card max-w-xl p-5">
              <p className="font-semibold">LaGecto Support</p>
              <p className="mt-2 text-sm">{CONTACT.phoneDisplay}</p>
              <p className="text-sm">{CONTACT.email}</p>
            </div>
          </SettingsPanel>
        ) : null}
        {current === "people" ? (
          <SettingsPanel title="Admin users" hint="Assign Admin, Manager, or Super Admin from the users list.">
            <SettingsLinkGrid items={links.people} />
          </SettingsPanel>
        ) : null}
        {current === "subscriptions" ? (
          <SettingsPanel title="Subscriptions" hint="Package names and prices are unchanged.">
            <SettingsLinkGrid items={links.subscriptions} />
          </SettingsPanel>
        ) : null}
        {current === "notifications" ? (
          <SettingsPanel title="Notifications" hint="Sound, popups, and tab alerts for this admin account. Broadcasts stay on the Notifications page.">
            <NotificationPrefs />
            <div className="mt-4">
              <SettingsLinkGrid items={links.notifications} />
            </div>
          </SettingsPanel>
        ) : null}
        {current === "security" && superAdmin ? (
          <SettingsPanel title="Security" hint="Unlock accounts and read the audit log. Super Admin only.">
            <SettingsLinkGrid items={links.security} />
          </SettingsPanel>
        ) : null}
      </SettingsLayout>
    </>
  );
}
