"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function ExpenseForm({ shopId, periodId }: { shopId: string; periodId: string }) {
  const router = useRouter();
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const supabase = createBrowserSupabase();
    await supabase.from("shop_expenses").insert({
      shop_id: shopId,
      period_id: periodId,
      category: String(form.get("category") || "general"),
      description: String(form.get("description") || ""),
      amount: Number(form.get("amount") || 0),
      expense_date: String(form.get("date") || new Date().toISOString().slice(0, 10)),
    });
    event.currentTarget.reset();
    router.refresh();
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl bg-white p-4 md:grid-cols-5">
      <input name="date" type="date" required className="rounded-xl border px-3 py-2" />
      <input name="category" placeholder="Category" className="rounded-xl border px-3 py-2" />
      <input name="description" required placeholder="Description" className="rounded-xl border px-3 py-2 md:col-span-2" />
      <input name="amount" type="number" step="0.01" required placeholder="Amount" className="rounded-xl border px-3 py-2" />
      <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white md:col-span-5">Add expense</button>
    </form>
  );
}
