import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentPeriod, loadOwnedShopWithFeatures } from "@/lib/entitlements";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { InsertForm } from "@/components/forms/InsertForm";
import { money, formatDate } from "@/lib/format";

export default async function PurchasesPage() {
  const { shop } = await loadOwnedShopWithFeatures();
  if (!shop) return null;
  const supabase = await createServerSupabase();
  const period = await getCurrentPeriod(shop.id);
  const { data: purchases } = await supabase
    .from("purchases")
    .select("*")
    .eq("shop_id", shop.id)
    .eq("period_id", period?.id || "00000000-0000-0000-0000-000000000000")
    .order("purchase_date", { ascending: false });
  return (
    <>
      <PageHeader title="Purchases" subtitle="Stock buys against the current financial period." />
      {period ? (
        <InsertForm
          table="purchases"
          extra={{ shop_id: shop.id, period_id: period.id }}
          fields={[
            { name: "total", type: "number", required: true, placeholder: "Total" },
            { name: "purchase_date", type: "date" },
            { name: "notes", placeholder: "Notes", className: "md:col-span-2" },
          ]}
        />
      ) : null}
      {!purchases?.length ? (
        <div className="mt-4">
          <EmptyState title="No purchases" body="Record supplier purchases for this period." />
        </div>
      ) : (
        <div className="app-table-wrap mt-6">
          <table className="app-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Total</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(row.purchase_date)}</td>
                  <td>{money(row.total)}</td>
                  <td>{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
