import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { NotificationPrefs } from "@/components/notifications/NotificationCenter";
import { NotificationInbox } from "@/components/notifications/NotificationInbox";

export default async function NotificationsPage() {
  const profile = await requireRole("customer");
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <>
      <PageHeader title="Notifications" subtitle="Order updates, receipts, and shop messages. Full private content stays in the conversation." />
      <div className="mb-6">
        <NotificationPrefs />
      </div>
      {!data?.length ? (
        <EmptyState title="No notifications" body="Order updates and receipts will appear here." />
      ) : (
        <NotificationInbox items={data} />
      )}
    </>
  );
}
