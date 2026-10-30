import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { BroadcastForm } from "@/components/admin/BroadcastForm";
import { formatDateTime } from "@/lib/format";

export default async function AdminNotificationsPage() {
  await requireRole("admin");
  const supabase = await createServerSupabase();
  const { data: updates } = await supabase.from("updates").select("*").order("created_at", { ascending: false });

  return (
    <>
      <PageHeader title="Notifications" subtitle="Send one-way customer announcements or two-way shop updates. Recipient lists stay in admin." />
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
    </>
  );
}
