"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EXPENSE_CATEGORIES } from "@/lib/features";
import { money, formatDate, titleCase } from "@/lib/format";
import { SegmentedControl } from "@/components/os/OsUi";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusBadge } from "@/components/ui/primitives";

export type ExpenseRow = {
  id: string;
  category: string;
  description: string;
  amount: number;
  expense_date: string;
  status?: string | null;
  payment_method?: string | null;
  reference?: string | null;
};

export function ExpenseBoard({
  expenses,
  endpoint = "/api/shop/expenses",
  categories = EXPENSE_CATEGORIES as unknown as string[],
  allowClear = true,
  clearTitle = "Clear all expenses?",
  clearBody = "This permanently deletes every expense in the current period so you can start from zero. Archived periods stay as they are.",
}: {
  expenses: ExpenseRow[];
  endpoint?: string;
  categories?: string[];
  allowClear?: boolean;
  clearTitle?: string;
  clearBody?: string;
}) {
  const router = useRouter();
  const [view, setView] = useState("cards");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("active");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [voidId, setVoidId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [nonce, setNonce] = useState(() => (typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now())));

  const rows = useMemo(() => {
    return expenses.filter((row) => {
      const hay = `${row.description} ${row.category} ${row.reference || ""}`.toLowerCase();
      const matchesQuery = hay.includes(query.trim().toLowerCase());
      const matchesCat = category === "all" || row.category === category;
      const matchesStatus = status === "all" || (row.status || "active") === status;
      return matchesQuery && matchesCat && matchesStatus;
    });
  }, [expenses, query, category, status]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    setBusy(true);
    setError("");
    setOk("");
    const form = new FormData(formEl);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: form.get("category"),
        description: form.get("description"),
        amount: form.get("amount"),
        expense_date: form.get("expense_date"),
        payment_method: form.get("payment_method"),
        reference: form.get("reference"),
        client_nonce: nonce,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) setError(data.error || "Unable to save this expense.");
    else {
      setOk("Expense saved.");
      setNonce(typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now()));
      formEl.reset();
      router.refresh();
    }
  }

  async function voidExpense() {
    if (!voidId) return;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "void", id: voidId }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Unable to void this expense.");
    else {
      setVoidId(null);
      router.refresh();
    }
  }

  async function deleteExpense() {
    if (!deleteId) return;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id: deleteId }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Unable to delete this expense.");
    else {
      setDeleteId(null);
      setOk("Expense deleted.");
      router.refresh();
    }
  }

  async function clearExpenses() {
    if (busy) return;
    setBusy(true);
    setError("");
    setOk("");
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear" }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Unable to clear expenses.");
      return;
    }
    setClearOpen(false);
    setOk(data.deleted ? `Cleared ${data.deleted} expense${data.deleted === 1 ? "" : "s"}.` : "Expenses cleared.");
    router.refresh();
  }

  return (
    <div className="grid gap-6">
      <form onSubmit={save} className="os-surface grid gap-3 md:grid-cols-3">
        <input name="expense_date" type="date" required className="rounded-xl border px-3 py-2" />
        <select name="category" className="rounded-xl border px-3 py-2" defaultValue="other">
          {categories.map((item) => (
            <option key={item} value={item}>
              {titleCase(item)}
            </option>
          ))}
        </select>
        <input name="amount" type="number" min="0" step="0.01" required placeholder="Amount" className="rounded-xl border px-3 py-2" />
        <input name="description" required placeholder="What was this for?" className="rounded-xl border px-3 py-2 md:col-span-2" />
        <input name="payment_method" placeholder="Payment method" className="rounded-xl border px-3 py-2" />
        <input name="reference" placeholder="Receipt / reference" className="rounded-xl border px-3 py-2 md:col-span-2" />
        <button disabled={busy} className="rounded-full bg-[#0B6E4F] px-4 py-2 text-white">
          {busy ? "Saving…" : "Add expense"}
        </button>
        {error ? <p className="text-sm text-red-700 md:col-span-3">{error}</p> : null}
        {ok ? <p className="text-sm text-[#0B6E4F] md:col-span-3">{ok}</p> : null}
      </form>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search expenses" className="flex-1 rounded-xl border px-3 py-2" />
        <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-xl border px-3 py-2">
          <option value="all">All categories</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {titleCase(item)}
            </option>
          ))}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border px-3 py-2">
          <option value="active">Active</option>
          <option value="voided">Voided</option>
          <option value="all">All</option>
        </select>
        <SegmentedControl
          value={view}
          onChange={setView}
          options={[
            { value: "cards", label: "Cards" },
            { value: "table", label: "Table" },
          ]}
        />
        {allowClear && expenses.length ? (
          <button
            type="button"
            className="min-h-11 rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700"
            onClick={() => setClearOpen(true)}
          >
            Clear all
          </button>
        ) : null}
      </div>

      {view === "cards" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((row) => (
            <article key={row.id} className="os-surface">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--lagecto-muted)]">{titleCase(row.category)}</p>
                  <p className="mt-1 font-semibold">{row.description}</p>
                  <p className="mt-1 text-sm text-[var(--lagecto-muted)]">{formatDate(row.expense_date)}</p>
                </div>
                <p className="text-lg font-semibold">{money(row.amount)}</p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge value={row.status || "active"} />
                {row.payment_method ? <span className="text-xs text-[var(--lagecto-muted)]">{row.payment_method}</span> : null}
                <div className="ml-auto flex gap-3">
                  {(row.status || "active") === "active" ? (
                    <button type="button" className="text-xs font-semibold text-[var(--lagecto-muted)]" onClick={() => setVoidId(row.id)}>
                      Void
                    </button>
                  ) : null}
                  <button type="button" className="text-xs font-semibold text-red-700" onClick={() => setDeleteId(row.id)}>
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="app-table-wrap">
          <table className="app-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(row.expense_date)}</td>
                  <td>{titleCase(row.category)}</td>
                  <td>{row.description}</td>
                  <td>{money(row.amount)}</td>
                  <td>
                    <StatusBadge value={row.status || "active"} />
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-3">
                      {(row.status || "active") === "active" ? (
                        <button type="button" className="text-sm text-[var(--lagecto-muted)]" onClick={() => setVoidId(row.id)}>
                          Void
                        </button>
                      ) : null}
                      <button type="button" className="text-sm text-red-700" onClick={() => setDeleteId(row.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(voidId)}
        title="Void this expense?"
        body="The record stays in history but is excluded from profit and loss."
        confirmLabel="Void"
        onCancel={() => setVoidId(null)}
        onConfirm={voidExpense}
      />
      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete this expense?"
        body="This removes it from the current period and from profit and loss. Archived period records cannot be deleted."
        confirmLabel="Delete"
        onCancel={() => setDeleteId(null)}
        onConfirm={deleteExpense}
      />
      <ConfirmDialog
        open={clearOpen}
        title={clearTitle}
        body={clearBody}
        confirmLabel={busy ? "Clearing…" : "Clear all"}
        onCancel={() => setClearOpen(false)}
        onConfirm={() => void clearExpenses()}
      />
    </div>
  );
}
