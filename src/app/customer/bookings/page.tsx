import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/format";

export default async function CustomerBookingsPage() {
  const profile = await requireRole("customer");
  const supabase = await createServerSupabase();
  const { data: bookings } = await supabase.from("service_bookings").select("*, shops(name)").eq("customer_id", profile.id).order("scheduled_at", { ascending: false });
  return (
    <>
      <PageHeader title="My bookings" subtitle="Book a service from a shop page." />
      {!bookings?.length ? (
        <EmptyState title="No bookings" body="Open a shop and request a service time." />
      ) : (
        <div className="grid gap-3">
          {bookings.map((row) => (
            <article key={row.id} className="rounded-2xl bg-white p-4">
              <p className="font-semibold">{(row.shops as { name?: string } | null)?.name}</p>
              <p className="text-sm text-[#6B7280]">{formatDateTime(row.scheduled_at)}</p>
              <StatusBadge value={row.status} />
            </article>
          ))}
        </div>
      )}
    </>
  );
}
