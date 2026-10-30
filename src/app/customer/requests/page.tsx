import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui/primitives";

export default async function CustomerRequestsPage() {
  const profile = await requireRole("customer");
  const supabase = await createServerSupabase();
  const { data: requests } = await supabase.from("service_requests").select("*, shops(name)").eq("customer_id", profile.id).order("created_at", { ascending: false });
  return (
    <>
      <PageHeader title="My requests" />
      {!requests?.length ? (
        <EmptyState title="No requests" body="Send a custom request from a shop page." />
      ) : (
        <div className="grid gap-3">
          {requests.map((row) => (
            <article key={row.id} className="rounded-2xl bg-white p-4">
              <p className="font-semibold">{row.title}</p>
              <p className="text-sm text-[#6B7280]">{(row.shops as { name?: string } | null)?.name}</p>
              <StatusBadge value={row.status} />
            </article>
          ))}
        </div>
      )}
    </>
  );
}
