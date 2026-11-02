"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { money, formatDate } from "@/lib/format";
import { DIARY_ART } from "@/lib/diary-visuals";
import { deleteDiary, insertDiary } from "@/components/diary/diary-actions";
import { EmptyDiary } from "@/components/diary/diary-ui";

type Row = Record<string, unknown> & { id: string };

function isIncome(row: Row) {
  if (row.entry_type === "income") return true;
  const cat = String(row.category || "").toLowerCase();
  return ["income", "salary", "wage", "sales", "revenue"].includes(cat);
}

export function DiaryBudget({ rows, userId }: { rows: Row[]; userId: string }) {
  const router = useRouter();
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [entryType, setEntryType] = useState("expense");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");

  const month = new Date().toISOString().slice(0, 7);
  const monthly = rows.filter((row) => String(row.entry_date || "").startsWith(month) || !row.entry_date);
  const income = monthly.filter(isIncome).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const expenses = monthly.filter((row) => !isIncome(row)).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const balance = income - expenses;
  const spendPct = income > 0 ? Math.min(100, (expenses / income) * 100) : expenses > 0 ? 100 : 0;

  async function add(event: React.FormEvent) {
    event.preventDefault();
    await insertDiary("diary_budget_entries", {
      user_id: userId,
      category: category.trim() || (entryType === "income" ? "income" : "general"),
      amount: Number(amount || 0),
      entry_date: date || new Date().toISOString().slice(0, 10),
      notes: notes.trim() || null,
      entry_type: entryType,
    });
    setCategory("");
    setAmount("");
    setNotes("");
    router.refresh();
  }

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of monthly.filter((item) => !isIncome(item))) {
      const key = String(row.category || "general");
      map.set(key, (map.get(key) || 0) + Number(row.amount || 0));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [monthly]);

  return (
    <div className="grid gap-5">
      <section className="lg-card p-5">
        <h2 className="font-semibold">Monthly overview</h2>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-[var(--lagecto-muted)]">Income</p>
            <p className="text-lg font-semibold text-[#0B6E4F]">{money(income)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--lagecto-muted)]">Expenses</p>
            <p className="text-lg font-semibold">{money(expenses)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--lagecto-muted)]">Balance</p>
            <p className={`text-lg font-semibold ${balance >= 0 ? "text-[#0B6E4F]" : "text-[#C2413B]"}`}>{money(balance)}</p>
          </div>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#ece6d6]">
          <div className="diary-progress h-full">
            <span style={{ width: `${spendPct}%`, background: "#0B6E4F" }} />
          </div>
        </div>
        {byCategory.length ? (
          <div className="mt-4 grid gap-2">
            {byCategory.map(([name, value]) => (
              <div key={name}>
                <div className="flex justify-between text-xs">
                  <span>{name}</span>
                  <span>{money(value)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#ece6d6]">
                  <div className="h-full rounded-full bg-[#2E8B57]" style={{ width: `${Math.min(100, (value / Math.max(expenses, 1)) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>
      <form onSubmit={(event) => void add(event)} className="lg-card grid gap-3 p-5">
        <div className="flex gap-2">
          <button type="button" onClick={() => setEntryType("income")} className={`rounded-full px-4 py-2 text-sm ${entryType === "income" ? "bg-[#0B6E4F] text-white" : "bg-white ring-1 ring-[var(--lagecto-border)]"}`}>
            Income
          </button>
          <button type="button" onClick={() => setEntryType("expense")} className={`rounded-full px-4 py-2 text-sm ${entryType === "expense" ? "bg-[#0B6E4F] text-white" : "bg-white ring-1 ring-[var(--lagecto-border)]"}`}>
            Expense
          </button>
        </div>
        <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Category" className="rounded-2xl border px-3 py-3" />
        <input type="number" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required placeholder="Amount" className="rounded-2xl border px-3 py-3" />
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="rounded-2xl border px-3 py-3" />
        <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes" className="rounded-2xl border px-3 py-3" />
        <button className="rounded-full bg-[#0B6E4F] px-4 py-3 text-sm font-semibold text-white">Add entry</button>
      </form>
      {!rows.length ? (
        <EmptyDiary title="Money becomes clearer when written down" body="Log income and spending for this month." art={DIARY_ART.budget} />
      ) : (
        <div className="grid gap-2">
          {rows.map((row) => (
            <article key={row.id} className="lg-card flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{String(row.category || "general")}</p>
                <p className="text-xs text-[var(--lagecto-muted)]">
                  {isIncome(row) ? "Income" : "Expense"} · {formatDate(String(row.entry_date || ""))}
                </p>
              </div>
              <div className="text-right">
                <p className={`font-semibold ${isIncome(row) ? "text-[#0B6E4F]" : ""}`}>{isIncome(row) ? "+" : "−"}{money(Number(row.amount || 0))}</p>
                <button type="button" className="text-xs text-[#C2413B]" onClick={() => void deleteDiary("diary_budget_entries", row.id).then(() => router.refresh())}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
