"use client";

import { useMemo, useState } from "react";
import { DataTable, StatusBadge } from "@/components/ui/primitives";
import { formatDateTime, money } from "@/lib/format";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/payments/methods";
import { ConfirmCashButton } from "@/components/shop/ConfirmCashButton";

export type PaymentRow = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  payment_method: PaymentMethod | string;
  status: string;
  provider_transaction_id: string | null;
  created_at: string;
  paid_at: string | null;
  orders?: { order_number?: string; customer_name?: string } | Array<{ order_number?: string; customer_name?: string }> | null;
  shops?: { name?: string } | Array<{ name?: string }> | null;
};

function relatedOrder(value: PaymentRow["orders"]) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function relatedShop(value: PaymentRow["shops"]) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

export function PaymentsTable({
  payments,
  showCustomer = true,
  showShop = false,
  confirmCash = false,
}: {
  payments: PaymentRow[];
  showCustomer?: boolean;
  showShop?: boolean;
  confirmCash?: boolean;
}) {
  const [method, setMethod] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  const rows = useMemo(() => {
    return payments.filter((payment) => {
      if (method && payment.payment_method !== method) return false;
      if (status && payment.status !== status) return false;
      if (from && new Date(payment.created_at) < new Date(from)) return false;
      if (to && new Date(payment.created_at) > new Date(`${to}T23:59:59`)) return false;
      if (minAmount && Number(payment.amount) < Number(minAmount)) return false;
      if (maxAmount && Number(payment.amount) > Number(maxAmount)) return false;
      return true;
    });
  }, [payments, method, status, from, to, minAmount, maxAmount]);

  return (
    <div className="grid gap-4">
      <div className="lg-card grid gap-2 p-4 sm:grid-cols-3 lg:grid-cols-6">
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
          <option value="">All methods</option>
          <option value="visa">Visa</option>
          <option value="mastercard">Mastercard</option>
          <option value="ecocash">EcoCash</option>
          <option value="cash">Cash</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="paid">Paid</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
          <option value="review_required">Review required</option>
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border px-3 py-2 text-sm" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border px-3 py-2 text-sm" />
        <input value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="Min amount" className="rounded-xl border px-3 py-2 text-sm" />
        <input value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="Max amount" className="rounded-xl border px-3 py-2 text-sm" />
      </div>
      <DataTable caption="Payments">
          <thead>
            <tr>
              <th>Date</th>
              <th>Order</th>
              {showShop ? <th>Shop</th> : null}
              {showCustomer ? <th>Customer</th> : null}
              <th className="num">Amount</th>
              <th>Method</th>
              <th>Status</th>
              <th>Reference</th>
              {confirmCash ? <th></th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((payment) => (
              <tr key={payment.id}>
                <td>{formatDateTime(payment.created_at)}</td>
                <td>{relatedOrder(payment.orders)?.order_number || payment.order_id.slice(0, 8)}</td>
                {showShop ? <td>{relatedShop(payment.shops)?.name || "—"}</td> : null}
                {showCustomer ? <td>{relatedOrder(payment.orders)?.customer_name || "—"}</td> : null}
                <td className="num">{money(payment.amount)}</td>
                <td>{PAYMENT_METHOD_LABELS[payment.payment_method as PaymentMethod] || payment.payment_method}</td>
                <td>
                  <StatusBadge value={payment.status} />
                </td>
                <td className="max-w-[140px] truncate text-xs">{payment.provider_transaction_id || "—"}</td>
                {confirmCash ? (
                  <td>
                    {payment.payment_method === "cash" && payment.status === "pending" ? (
                      <ConfirmCashButton paymentId={payment.id} />
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
      </DataTable>
    </div>
  );
}
