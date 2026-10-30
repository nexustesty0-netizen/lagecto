import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { money } from "@/lib/format";
import { PlansManager } from "@/components/admin/PlansManager";

export default async function SubscriptionsPage() {
  await requireRole("admin");
  const supabase = await createServerSupabase();
  const [{ data: plans }, { data: subs }] = await Promise.all([
    supabase.from("subscription_plans").select("*").order("display_order", { ascending: true }).order("price"),
    supabase.from("subscriptions").select("id, shop_name, plan, package_key, duration_key, status, payment_status, amount, renewal_date").order("created_at", { ascending: false }),
  ]);

  return (
    <>
      <PageHeader title="Subscription packages" subtitle="Thabi, Kristen, and Sandra — 1, 3, 6, 9 months or 1 year. Assigning a paid plan verifies the shop until the end date." />
      <PlansManager plans={plans || []} />
      {!subs?.length ? (
        <div className="mt-6">
          <EmptyState title="No shop subscriptions yet" body="Assign a package from the shops page." />
        </div>
      ) : (
        <div className="app-table-wrap mt-6">
          <table className="app-table">
            <thead>
              <tr>
                <th>Shop</th>
                <th>Plan</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Renewal</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((sub) => (
                <tr key={sub.id}>
                  <td>{sub.shop_name}</td>
                  <td>{sub.plan || sub.package_key}</td>
                  <td>{sub.duration_key || "—"}</td>
                  <td>{sub.status}{sub.payment_status ? ` · ${sub.payment_status}` : ""}</td>
                  <td>{money(sub.amount)}</td>
                  <td>{sub.renewal_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
