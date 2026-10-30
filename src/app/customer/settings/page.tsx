import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/primitives";
import { ProfileSettingsForm } from "@/components/settings/ProfileSettingsForm";
import { NotificationPrefs } from "@/components/notifications/NotificationCenter";

export default async function CustomerSettingsPage() {
  const profile = await requireRole("customer");
  return (
    <>
      <PageHeader title="Settings" subtitle="You can edit permitted profile fields only. Role and security fields are protected." />
      <div className="mb-6">
        <NotificationPrefs />
      </div>
      <ProfileSettingsForm profile={profile} />
    </>
  );
}
