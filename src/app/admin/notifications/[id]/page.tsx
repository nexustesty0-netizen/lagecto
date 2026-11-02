import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdminLevel } from "@/lib/auth/session";
import { NotificationRead } from "@/components/notifications/NotificationRead";
import { notificationRelatedHref } from "@/lib/notifications";

export default async function AdminNotificationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireAdminLevel("admin");
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: item } = await supabase.from("notifications").select("*").eq("user_id", profile.id).eq("id", id).maybeSingle();
  if (!item) notFound();
  if (!item.is_read) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", item.id).eq("user_id", profile.id);
  }
  return (
    <NotificationRead
      item={item}
      backHref="/admin/notifications"
      relatedHref={notificationRelatedHref(item, "admin")}
    />
  );
}
