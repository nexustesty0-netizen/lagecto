import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui/primitives";
import { StatusPatch } from "@/components/forms/StatusPatch";
import { formatDateTime } from "@/lib/format";

export default async function BookingsPage() {
  const { shop } = await getOwnedShop();
  if (!shop) return null;
  const supabase = await createServerSupabase();
  const { data: bookings } = await supabase.from("service_bookings").select("*").eq("shop_id", shop.id).order("scheduled_at", { ascending: false });
  return (
    <>
      <PageHeader title="Bookings" subtitle="Service appointments for this shop." />
      {!bookings?.length ? (
        <EmptyState title="No bookings" body="Customer bookings will appear here." />
      ) : (
        <div className="app-table-wrap">
          <table className="app-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Customer</th>
                <th>Notes</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((row) => (
                <tr key={row.id}>
                  <td>{formatDateTime(row.scheduled_at)}</td>
                  <td>{row.customer_name || "Customer"}</td>
                  <td>{row.notes}</td>
                  <td>
                    <StatusBadge value={row.status} />
                  </td>
                  <td>
                    <StatusPatch table="service_bookings" id={row.id} options={["pending", "confirmed", "completed", "cancelled"]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
