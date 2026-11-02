import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui/primitives";
import { formatDateTime, money } from "@/lib/format";

function shopName(value: unknown) {
  if (Array.isArray(value)) return String((value[0] as { name?: string } | undefined)?.name || "");
  return String((value as { name?: string } | null)?.name || "");
}

export default async function AdminOrdersPage() {
  await requireRole("admin");
  const supabase = await createServerSupabase();
  const [{ data: orders }, { data: enquiries }] = await Promise.all([
    supabase.from("orders").select("id, order_number, total, status, created_at, shops(name)").order("created_at", { ascending: false }).limit(100),
    supabase.from("service_requests").select("id, title, status, created_at, customer_name, shops(name)").order("created_at", { ascending: false }).limit(80),
  ]);

  return (
    <>
      <PageHeader title="Orders and enquiries" subtitle="Marketplace orders and shop service requests. Counts are live." />
      {!orders?.length ? (
        <EmptyState title="No orders" body="Orders appear after customers check out." />
      ) : (
        <div className="app-table-wrap">
          <table className="app-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Shop</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.order_number}</td>
                  <td>{shopName(order.shops)}</td>
                  <td>{money(order.total)}</td>
                  <td>
                    <StatusBadge value={order.status} />
                  </td>
                  <td>{formatDateTime(order.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h2 className="mb-3 mt-8 text-lg font-semibold">Service enquiries</h2>
      {!enquiries?.length ? (
        <p className="text-sm text-[var(--lagecto-muted)]">No service enquiries yet.</p>
      ) : (
        <div className="app-table-wrap">
          <table className="app-table">
            <thead>
              <tr>
                <th>Request</th>
                <th>Shop</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {enquiries.map((row) => (
                <tr key={row.id}>
                  <td>{row.title}</td>
                  <td>{shopName(row.shops)}</td>
                  <td>{row.customer_name || "Customer"}</td>
                  <td>
                    <StatusBadge value={row.status} />
                  </td>
                  <td>{formatDateTime(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
