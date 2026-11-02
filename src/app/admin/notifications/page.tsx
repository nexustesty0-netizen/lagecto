import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdminLevel } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { BroadcastForm } from "@/components/admin/BroadcastForm";
import { NotificationInbox } from "@/components/notifications/NotificationInbox";
import { NotificationPrefs } from "@/components/notifications/NotificationPrefs";
import { formatDateTime } from "@/lib/format";
import { NOTICE_PAGE_SIZE, noticePage } from "@/lib/notifications";

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const profile = await requireAdminLevel("admin");
  const { page: rawPage } = await searchParams;
  const page = noticePage(rawPage);
  const from = (page - 1) * NOTICE_PAGE_SIZE;
  const supabase = await createServerSupabase();
  const [{ data, count }, { data: updates }] = await Promise.all([
    supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .range(from, from + NOTICE_PAGE_SIZE - 1),
    supabase.from("updates").select("*").order("created_at", { ascending: false }).limit(20),
  ]);
  const total = count || 0;
  const nextHref = from + NOTICE_PAGE_SIZE < total ? `/admin/notifications?page=${page + 1}` : null;
  const prevHref = page > 1 ? `/admin/notifications?page=${page - 1}` : null;

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Your inbox for shop registrations, support messages, and platform alerts."
        action={
          <Link href="/admin/settings?tab=notifications" className="text-sm font-medium text-[#0B6E4F]">
            Notification settings
          </Link>
        }
      />
      <div className="mb-6">
        <NotificationPrefs />
      </div>
      {!data?.length ? (
        <EmptyState title="No notifications" body="Shop registrations, verification requests, and support messages appear here." />
      ) : (
        <NotificationInbox items={data} audience="admin" nextHref={nextHref} prevHref={prevHref} />
      )}
      <div className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Broadcasts</h2>
        <p className="mb-4 text-sm text-[var(--lagecto-muted)]">Send one-way customer announcements or two-way shop updates. Recipient lists stay in admin.</p>
        <BroadcastForm />
        {!updates?.length ? (
          <div className="mt-4">
            <EmptyState title="No broadcasts" body="Sent updates will appear here." />
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {updates.map((update) => (
              <article key={update.id} className="rounded-2xl bg-white p-4">
                <p className="font-semibold">{update.title}</p>
                <p className="text-sm text-[#6B7280]">{update.message}</p>
                <p className="text-xs text-[#6B7280]">{formatDateTime(update.created_at)}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
