import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { NotificationPrefs } from "@/components/notifications/NotificationPrefs";
import { NotificationInbox } from "@/components/notifications/NotificationInbox";
import { CASHIER_NOTICE_TYPES, NOTICE_PAGE_SIZE, noticePage } from "@/lib/notifications";

export default async function ShopNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { shop, staffRole } = await getOwnedShop();
  if (!shop) return null;
  const { page: rawPage } = await searchParams;
  const page = noticePage(rawPage);
  const from = (page - 1) * NOTICE_PAGE_SIZE;
  const supabase = await createServerSupabase();
  let query = supabase
    .from("shop_notifications")
    .select("*", { count: "exact" })
    .eq("shop_id", shop.id);
  if (staffRole === "cashier") query = query.in("type", [...CASHIER_NOTICE_TYPES]);
  const { data, count } = await query.order("created_at", { ascending: false }).range(from, from + NOTICE_PAGE_SIZE - 1);
  const total = count || 0;
  const nextHref = from + NOTICE_PAGE_SIZE < total ? `/shop/notifications?page=${page + 1}` : null;
  const prevHref = page > 1 ? `/shop/notifications?page=${page - 1}` : null;

  return (
    <>
      <PageHeader title="Notifications" subtitle="Orders, messages, and stock alerts for this shop." />
      <div className="mb-6">
        <NotificationPrefs />
      </div>
      {!data?.length ? (
        <EmptyState title="No notifications" body="New orders, messages, and stock alerts appear here." />
      ) : (
        <NotificationInbox items={data} audience="shop" nextHref={nextHref} prevHref={prevHref} />
      )}
    </>
  );
}
