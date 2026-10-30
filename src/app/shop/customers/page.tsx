import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { money } from "@/lib/format";

export default async function ShopCustomersPage() {
  const { shop } = await getOwnedShop();
  if (!shop) return null;
  const supabase = await createServerSupabase();
  const { data: orders } = await supabase
    .from("orders")
    .select("customer_name, customer_email, customer_phone, total")
    .eq("shop_id", shop.id);

  const grouped = Object.values(
    (orders || []).reduce(
      (acc: Record<string, { name: string; email: string; phone: string; orders: number; spent: number }>, order) => {
        const key = order.customer_email || order.customer_name || "Guest";
        acc[key] ??= { name: order.customer_name || "Guest", email: order.customer_email || "", phone: order.customer_phone || "", orders: 0, spent: 0 };
        acc[key].orders += 1;
        acc[key].spent += Number(order.total || 0);
        return acc;
      },
      {},
    ),
  );

  return (
    <>
      <PageHeader title="Customers" subtitle="Built from orders placed at your shop." />
      {!grouped.length ? (
        <EmptyState title="No customers yet" body="Customers appear after they place orders." />
      ) : (
        <div className="app-table-wrap">
          <table className="app-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Orders</th>
                <th>Spent</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((row) => (
                <tr key={row.email || row.name}>
                  <td>{row.name}</td>
                  <td>{row.email}</td>
                  <td>{row.orders}</td>
                  <td>{money(row.spent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
