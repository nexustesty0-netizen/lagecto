"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function DeactivateEmployeeButton({ employeeId, name }: { employeeId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    const res = await fetch("/api/shop/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deactivate", id: employeeId }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Unable to deactivate.");
    else {
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      <button type="button" className="rounded-full border border-red-200 px-4 py-2 text-sm text-red-700" onClick={() => setOpen(true)}>
        Deactivate
      </button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <ConfirmDialog
        open={open}
        title={`Deactivate ${name}?`}
        body="The record stays for payroll history. This employee will no longer appear as active staff."
        confirmLabel="Deactivate"
        onCancel={() => setOpen(false)}
        onConfirm={confirm}
      />
    </>
  );
}

export function PayrollActions({
  employeeId,
  records,
}: {
  employeeId: string;
  records: { id: string; status: string; net_pay: number }[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function createPay(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    setBusy(true);
    setError("");
    const form = new FormData(formEl);
    const res = await fetch("/api/shop/payroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId,
        periodStart: form.get("period_start"),
        periodEnd: form.get("period_end"),
        deductions: form.get("deductions"),
        bonuses: form.get("bonuses"),
        notes: form.get("notes"),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) setError(data.error || "Unable to create payroll.");
    else {
      formEl.reset();
      router.refresh();
    }
  }

  async function setStatus(id: string, status: string) {
    setError("");
    const res = await fetch("/api/shop/payroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", id, status }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Unable to update payroll.");
    else router.refresh();
  }

  return (
    <div className="grid gap-4">
      <form onSubmit={createPay} className="grid gap-3 md:grid-cols-2">
        <input name="period_start" type="date" className="rounded-xl border px-3 py-2" />
        <input name="period_end" type="date" className="rounded-xl border px-3 py-2" />
        <input name="bonuses" type="number" min="0" step="0.01" placeholder="Bonus" className="rounded-xl border px-3 py-2" />
        <input name="deductions" type="number" min="0" step="0.01" placeholder="Deduction" className="rounded-xl border px-3 py-2" />
        <input name="notes" placeholder="Note" className="rounded-xl border px-3 py-2 md:col-span-2" />
        <button disabled={busy} className="rounded-full bg-[#0B6E4F] px-4 py-2 text-white md:col-span-2">
          {busy ? "Creating…" : "Create draft from current salary"}
        </button>
      </form>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="grid gap-2">
        {records.map((row) => (
          <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--lagecto-border)] px-3 py-2 text-sm">
            <span>
              {row.status} · {row.net_pay}
            </span>
            <div className="flex flex-wrap gap-2">
              {row.status === "draft" ? (
                <button type="button" className="rounded-full border px-3 py-1" onClick={() => setStatus(row.id, "pending")}>
                  Submit
                </button>
              ) : null}
              {row.status === "pending" || row.status === "draft" ? (
                <button type="button" className="rounded-full border px-3 py-1" onClick={() => setStatus(row.id, "approved")}>
                  Approve
                </button>
              ) : null}
              {row.status !== "paid" && row.status !== "cancelled" ? (
                <button type="button" className="rounded-full bg-[#0B6E4F] px-3 py-1 text-white" onClick={() => setStatus(row.id, "paid")}>
                  Mark paid
                </button>
              ) : null}
              {row.status !== "paid" && row.status !== "cancelled" ? (
                <button type="button" className="rounded-full border px-3 py-1 text-red-700" onClick={() => setStatus(row.id, "cancelled")}>
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
