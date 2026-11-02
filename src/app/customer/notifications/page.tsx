import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { NotificationInbox } from "@/components/notifications/NotificationInbox";
import { NOTICE_PAGE_SIZE, noticePage } from "@/lib/notifications";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const profile = await requireRole("customer");
  const { page: rawPage } = await searchParams;
  const page = noticePage(rawPage);
  const from = (page - 1) * NOTICE_PAGE_SIZE;
  const supabase = await createServerSupabase();
  const { data, count } = await supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .range(from, from + NOTICE_PAGE_SIZE - 1);
  const total = count || 0;
  const nextHref = from + NOTICE_PAGE_SIZE < total ? `/customer/notifications?page=${page + 1}` : null;
  const prevHref = page > 1 ? `/customer/notifications?page=${page - 1}` : null;

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Order updates, receipts, and shop messages. Sound preferences are in Settings."
        action={
          <Link href="/customer/settings?tab=notifications" className="text-sm font-medium text-[#0B6E4F]">
            Notification settings
          </Link>
        }
      />
      {!data?.length ? (
        <EmptyState
          title="No notifications"
          body="Order updates and receipts will appear here after you place an order or a shop messages you."
          action={
            <Link href="/marketplace" className="inline-flex rounded-full bg-[#0B6E4F] px-4 py-2 text-sm font-semibold text-white">
              Browse marketplace
            </Link>
          }
        />
      ) : (
        <NotificationInbox items={data} audience="customer" nextHref={nextHref} prevHref={prevHref} />
      )}
    </>
  );
}
