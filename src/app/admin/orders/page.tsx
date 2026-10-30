import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui/primitives";
import { formatDateTime, money } from "@/lib/format";

export default async function AdminOrdersPage() {
  await requireRole("admin");
  const supabase = await createServerSupabase();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, total, status, created_at, shops(name)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <>
      <PageHeader title="Orders" subtitle="Platform-wide order oversight." />
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
                  <td>{(order.shops as { name?: string } | null)?.name}</td>
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
    </>
  );
}
