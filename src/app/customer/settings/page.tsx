import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/primitives";
import { ProfileSettingsForm } from "@/components/settings/ProfileSettingsForm";
import { PasswordChangeForm } from "@/components/settings/PasswordChangeForm";
import { NotificationPrefs } from "@/components/notifications/NotificationPrefs";
import { DeleteAccountCard } from "@/components/settings/DeleteAccountCard";
import { SettingsLayout, SettingsPanel } from "@/components/settings/SettingsLayout";
import { customerSettingTabs, pickSettingsTab } from "@/lib/settings-nav";

export default async function CustomerSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const profile = await requireRole("customer");
  const { tab } = await searchParams;
  const tabs = customerSettingTabs();
  const current = pickSettingsTab(tabs, tab);

  return (
    <>
      <PageHeader title="Profile & settings" subtitle="Change only what this customer account is allowed to change. Role and security flags stay locked." />
      <SettingsLayout basePath="/customer/settings" tabs={tabs} current={current}>
        {current === "profile" ? (
          <SettingsPanel title="Profile" hint="Your display name is what shops see on orders and messages.">
            <ProfileSettingsForm profile={profile} />
          </SettingsPanel>
        ) : null}
        {current === "security" ? (
          <SettingsPanel title="Account security" hint="We check your current password before saving a new one.">
            <PasswordChangeForm />
          </SettingsPanel>
        ) : null}
        {current === "notifications" ? (
          <SettingsPanel title="Notifications" hint="Sounds, popups, and tab alerts for this customer account. They are not a new message channel.">
            <NotificationPrefs />
          </SettingsPanel>
        ) : null}
        {current === "privacy" ? (
          <SettingsPanel title="Privacy" hint="Shops see your display name, not your email address.">
            <div className="lg-card max-w-xl p-5 text-sm leading-6 text-[var(--lagecto-muted)]">
              <p>Shops see your display name on messages and orders, not your email address.</p>
              <p className="mt-2">
                Read the{" "}
                <Link href="/support/privacy" className="font-medium text-[#0B6E4F]">
                  privacy notice
                </Link>{" "}
                and{" "}
                <Link href="/support/terms" className="font-medium text-[#0B6E4F]">
                  terms
                </Link>
                .
              </p>
            </div>
          </SettingsPanel>
        ) : null}
        {current === "preferences" ? (
          <SettingsPanel title="Preferences" hint="Language and theme switches are not available on this account.">
            <div className="lg-card max-w-xl p-5 text-sm leading-6 text-[var(--lagecto-muted)]">
              <p>LaGecto is shown in English.</p>
              <p className="mt-2">Sound alerts are in Notifications. There is no separate language or theme setting here.</p>
            </div>
          </SettingsPanel>
        ) : null}
        {current === "account" ? (
          <SettingsPanel title="Account management">
            <div className="max-w-xl">
              <DeleteAccountCard profile={profile} />
            </div>
            <div className="flex flex-wrap gap-4 text-sm font-semibold text-[#0B6E4F]">
              <Link href="/support">Help centre</Link>
              <Link href="/support/faqs">FAQs</Link>
              <Link href="/support/contact">Contact</Link>
              <Link href="/customer/chat">Messages</Link>
            </div>
          </SettingsPanel>
        ) : null}
      </SettingsLayout>
    </>
  );
}
