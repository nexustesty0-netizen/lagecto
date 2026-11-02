"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusBadge } from "@/components/ui/primitives";
import { formatDateTime, money } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payments/methods";

export type HistorySale = {
  id: string;
  sale_number: string | null;
  customer_name: string | null;
  total: number;
  status: string;
  sale_date: string;
  payment_method: string | null;
  cashier_name?: string | null;
  order_id?: string | null;
  receipt_id?: string | null;
};

export function PosSalesHistory({
  sales,
  showAllLink = true,
  canManage = false,
}: {
  sales: HistorySale[];
  showAllLink?: boolean;
  canManage?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<HistorySale | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function remove() {
    if (!pending) return;
    const res = await fetch("/api/shop/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id: pending.id }),
    });
    const data = await res.json();
    setPending(null);
    if (!res.ok) {
      setMessage(data.error || "Unable to delete this sale.");
      return;
    }
    setMessage("Sale deleted and stock returned.");
    router.refresh();
  }

  async function clearSales() {
    if (busy) return;
    setBusy(true);
    const res = await fetch("/api/shop/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear" }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || "Unable to clear sales.");
      return;
    }
    setClearOpen(false);
    setMessage(data.deleted ? `Cleared ${data.deleted} sale${data.deleted === 1 ? "" : "s"} and returned stock.` : "Sales cleared.");
    router.refresh();
  }

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">Sales in this period</p>
          <h2 className="text-lg font-semibold">All recorded sales</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {showAllLink ? (
            <Link href="/shop/sales" className="text-sm text-[#0B6E4F]">
              Open full sales list
            </Link>
          ) : null}
          {canManage && sales.length ? (
            <button
              type="button"
              className="min-h-11 rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700"
              onClick={() => setClearOpen(true)}
            >
              Clear all sales
            </button>
          ) : null}
        </div>
      </div>
      {message ? <p className="mb-3 text-sm text-[#0B6E4F]">{message}</p> : null}
      {!sales.length ? (
        <p className="rounded-2xl bg-white p-4 text-sm text-[#6B7280]">No sales recorded yet.</p>
      ) : (
        <>
        <div className="grid gap-2 md:hidden">
          {sales.map((sale) => (
            <article key={sale.id} className="rounded-2xl border border-[var(--lagecto-border)] bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{sale.sale_number || "Sale"}</p>
                  <p className="text-xs text-[var(--lagecto-muted)]">{sale.customer_name || "Walk-in"}</p>
                </div>
                <p className="text-sm font-semibold">{money(sale.total)}</p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge value={sale.status} />
                <span className="text-xs text-[var(--lagecto-muted)]">{formatDateTime(sale.sale_date)}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <Link href={`/shop/sales/${sale.id}`} className="font-semibold text-[#0B6E4F]">
                  View
                </Link>
                {sale.receipt_id ? (
                  <Link href={`/shop/receipts/${sale.receipt_id}`} className="font-semibold text-[#0B6E4F]">
                    Receipt
                  </Link>
                ) : null}
                {canManage ? (
                  <>
                    <Link href={`/shop/sales/${sale.id}/edit`} className="font-semibold text-[#0B6E4F]">
                      Correct
                    </Link>
                    <button type="button" className="text-red-700" onClick={() => setPending(sale)}>
                      Void
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          ))}
        </div>
        <div className="app-table-wrap hidden md:block">
          <table className="app-table">
            <thead>
              <tr>
                <th>Sale</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id}>
                  <td>
                    <p>{sale.sale_number || "Sale"}</p>
                    {sale.cashier_name ? <p className="text-xs text-[#6B7280]">{sale.cashier_name}</p> : null}
                  </td>
                  <td>{sale.customer_name || "Walk-in"}</td>
                  <td>
                    <p>{money(sale.total)}</p>
                    <StatusBadge value={sale.status} />
                  </td>
                  <td>{paymentMethodLabel(sale.payment_method)}</td>
                  <td>{formatDateTime(sale.sale_date)}</td>
                  <td className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link href={`/shop/sales/${sale.id}`} className="text-sm text-[#0B6E4F]">
                        View
                      </Link>
                      {sale.receipt_id ? (
                        <Link href={`/shop/receipts/${sale.receipt_id}`} className="text-sm text-[#0B6E4F]">
                          Receipt
                        </Link>
                      ) : null}
                      {canManage ? (
                        <>
                          <Link href={`/shop/sales/${sale.id}/edit`} className="text-sm text-[#0B6E4F]">
                            Correct
                          </Link>
                          <button type="button" className="text-sm text-red-700" onClick={() => setPending(sale)}>
                            Void
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
      <ConfirmDialog
        open={Boolean(pending)}
        title="Void this sale?"
        body="Use this only for a mistake. The linked receipt is removed and catalogue stock is returned. Archived periods cannot be changed."
        confirmLabel="Void sale"
        onCancel={() => setPending(null)}
        onConfirm={() => void remove()}
      />
      <ConfirmDialog
        open={clearOpen}
        title="Clear all sales?"
        body="This deletes every sale in the current period, removes their receipts, and returns catalogue stock so you can start the till from zero. Archived periods stay as they are."
        confirmLabel={busy ? "Clearing…" : "Clear all sales"}
        onCancel={() => setClearOpen(false)}
        onConfirm={() => void clearSales()}
      />
    </section>
  );
}
