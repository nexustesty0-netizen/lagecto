import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui/primitives";
import { formatDateTime, money } from "@/lib/format";

export default async function CustomerOrdersPage() {
  const profile = await requireRole("customer");
  const supabase = await createServerSupabase();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, total, status, payment_status, created_at, shops(name)")
    .eq("customer_id", profile.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader title="Orders" subtitle="Track every order you have placed. Payment is arranged directly with the shop on WhatsApp." />
      {!orders?.length ? (
        <EmptyState title="No orders yet" body="When you check out, orders will appear here." />
      ) : (
        <div className="app-table-wrap">
          <table className="app-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Shop</th>
                <th>Total</th>
                <th>Status</th>
                <th>Placed</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link href={`/customer/orders/${order.id}`} className="text-[#0B6E4F]">
                      {order.order_number}
                    </Link>
                  </td>
                  <td>{(order.shops as { name?: string } | null)?.name || "—"}</td>
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
      <div className="mt-4 flex gap-4 text-sm text-[#0B6E4F]">
        <Link href="/customer/receipts">View receipts</Link>
      </div>
    </>
  );
}
