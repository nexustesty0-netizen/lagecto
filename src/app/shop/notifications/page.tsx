import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { NotificationPrefs } from "@/components/notifications/NotificationCenter";
import { NotificationInbox } from "@/components/notifications/NotificationInbox";

export default async function ShopNotificationsPage() {
  const { shop } = await getOwnedShop();
  if (!shop) return null;
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("shop_notifications")
    .select("*")
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false })
    .limit(80);

  return (
    <>
      <PageHeader title="Notifications" subtitle="Orders, stock, payroll, and admin updates for this shop." />
      <div className="mb-6">
        <NotificationPrefs />
      </div>
      {!data?.length ? (
        <EmptyState title="No notifications" body="New orders, messages, and stock alerts appear here." />
      ) : (
        <NotificationInbox items={data} />
      )}
    </>
  );
}
