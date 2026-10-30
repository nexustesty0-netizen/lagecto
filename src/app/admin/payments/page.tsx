import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui/primitives";
import { PaymentsTable, type PaymentRow } from "@/components/payments/PaymentsTable";
import { AdminRefundCompleteForm } from "@/components/admin/AdminRefundCompleteForm";

export default async function AdminPaymentsPage() {
  await requireRole("admin");
  const supabase = await createServerSupabase();
  const [{ data: payments }, { data: refunds }, { data: reviews }] = await Promise.all([
    supabase
      .from("payments")
      .select("id, order_id, amount, currency, payment_method, status, provider_transaction_id, created_at, paid_at, orders(order_number, customer_name), shops(name)")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("payment_refunds").select("id, amount, status, refund_kind, provider_refund_id, created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("payments").select("id, status, review_reason, shop_id").eq("status", "review_required").limit(50),
  ]);

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="Customer marketplace checkout no longer collects online payments. Historical records stay here. Payment is arranged between customer and shop on WhatsApp."
      />
      {!payments?.length ? (
        <EmptyState title="No payments" body="Marketplace checkout is via WhatsApp. Historical or POS records would appear here." />
      ) : (
        <PaymentsTable payments={(payments || []) as PaymentRow[]} showShop confirmCash={false} />
      )}
      <h2 className="mb-3 mt-8 text-lg font-semibold">Needs review</h2>
      {!reviews?.length ? (
        <EmptyState title="No flagged payments" body="Repeated failures, amount mismatches, and suspicious webhook activity appear here." />
      ) : (
        <div className="grid gap-2">
          {reviews.map((row) => (
            <article key={row.id} className="rounded-2xl bg-white p-4">
              <StatusBadge value={row.status} />
              <p className="mt-2 text-sm">{row.review_reason || "Review required"}</p>
            </article>
          ))}
        </div>
      )}
      <h2 className="mb-3 mt-8 text-lg font-semibold">Refunds</h2>
      {!refunds?.length ? (
        <EmptyState title="No refunds" body="Requested and completed refunds appear here." />
      ) : (
        <div className="app-table-wrap">
          <table className="app-table">
            <thead>
              <tr>
                <th>Amount</th>
                <th>Kind</th>
                <th>Status</th>
                <th>Provider ref</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {refunds.map((refund) => (
                <tr key={refund.id}>
                  <td>{refund.amount}</td>
                  <td>{refund.refund_kind}</td>
                  <td>
                    <StatusBadge value={refund.status} />
                  </td>
                  <td>{refund.provider_refund_id || "—"}</td>
                  <td>
                    {refund.refund_kind === "provider" && refund.status === "requested" ? (
                      <AdminRefundCompleteForm refundId={refund.id} />
                    ) : null}
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
