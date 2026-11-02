"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { filterAdminCustomers, publicCustomerContact } from "@/lib/admin/control-centre";
import { formatDateTime } from "@/lib/format";

type CustomerRow = {
  id: string;
  name: string | null;
  email: string | null;
  username: string | null;
  account_status: string;
  created_at: string;
  last_login_at?: string | null;
};

export function CustomerDesk({
  customers,
  canSeeContact,
}: {
  customers: CustomerRow[];
  canSeeContact: boolean;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const visible = useMemo(
    () => filterAdminCustomers(customers, query, status, canSeeContact),
    [customers, query, status, canSeeContact],
  );

  return (
    <div className="grid gap-3">
      <div className="grid gap-2 md:grid-cols-[1fr_10rem]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={canSeeContact ? "Search name, username or email" : "Search name or username"}
          className="rounded-xl border px-3 py-2"
        />
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border px-3 py-2">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="locked">Locked</option>
          <option value="suspended">Suspended</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>
      <p className="text-sm text-[var(--lagecto-muted)]">{visible.length} customer{visible.length === 1 ? "" : "s"}</p>
      <div className="app-table-wrap">
        <table className="app-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Status</th>
              <th>Joined</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((customer) => (
              <tr key={customer.id}>
                <td>
                  <p>{customer.name || customer.username || "Customer"}</p>
                  <p className="text-xs text-[#6B7280]">
                    {customer.username ? `@${customer.username}` : null}
                    {canSeeContact && publicCustomerContact(customer.email, true) ? ` · ${customer.email}` : ""}
                  </p>
                </td>
                <td>
                  <StatusBadge value={customer.account_status || "active"} />
                </td>
                <td>{formatDateTime(customer.created_at)}</td>
                <td className="text-right">
                  <Link href={`/admin/customers/${customer.id}`} className="text-sm font-semibold text-[#0B6E4F]">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visible.length ? <p className="text-sm text-[#6B7280]">No customers match this search.</p> : null}
    </div>
  );
}

export function CustomerRestrictForm({ userId, status }: { userId: string; status: string }) {
  const router = useRouter();
  const [nextStatus, setNextStatus] = useState(status === "active" ? "locked" : "active");
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/security", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_account_status", userId, status: nextStatus, reason }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setOpen(false);
    if (!res.ok) {
      setError(data.error || "Unable to change this account.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="os-surface mt-6">
      <h2 className="font-semibold">Account restrictions</h2>
      <p className="mt-1 text-sm text-[var(--lagecto-muted)]">Only a super admin can lock, suspend, or restore a customer account. This is written to the audit log.</p>
      <div className="mt-3 grid gap-2 md:grid-cols-[10rem_1fr_auto]">
        <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} className="rounded-xl border px-3 py-2">
          <option value="active">active</option>
          <option value="locked">locked</option>
          <option value="suspended">suspended</option>
          <option value="disabled">disabled</option>
        </select>
        <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason (optional)" className="rounded-xl border px-3 py-2" />
        <button type="button" className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white" onClick={() => setOpen(true)}>
          Apply
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <ConfirmDialog
        open={open}
        title="Change this account?"
        body={`Set this customer to ${nextStatus}. They may lose access immediately.`}
        confirmLabel="Change status"
        onCancel={() => setOpen(false)}
        onConfirm={() => void save()}
      />
    </div>
  );
}
