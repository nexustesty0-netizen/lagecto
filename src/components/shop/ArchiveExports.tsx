"use client";

import { csvEscape, money } from "@/lib/format";
import { escapeHtml } from "@/lib/receipts";

type Sale = { sale_number: string; customer_name: string | null; total: number; sale_date: string; payment_method: string | null };
type Expense = { expense_date: string; category: string; description: string; amount: number };

export function ArchiveExports({
  periodLabel,
  sales,
  expenses,
}: {
  periodLabel: string;
  sales: Sale[];
  expenses: Expense[];
}) {
  function excel() {
    const lines = [
      ["Type", "Reference", "Detail", "Amount", "Date"].join(","),
      ...sales.map((sale) =>
        ["Sale", csvEscape(sale.sale_number), csvEscape(sale.customer_name), sale.total, sale.sale_date].join(","),
      ),
      ...expenses.map((expense) =>
        ["Expense", csvEscape(expense.category), csvEscape(expense.description), expense.amount, expense.expense_date].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${periodLabel.replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function pdf() {
    const html = `<html><body><h1>${escapeHtml(periodLabel)}</h1>
      <h2>Sales</h2>
      ${sales.map((s) => `<p>${escapeHtml(s.sale_number)} ${escapeHtml(s.customer_name || "")} ${money(s.total)}</p>`).join("")}
      <h2>Expenses</h2>
      ${expenses.map((e) => `<p>${escapeHtml(e.expense_date)} ${escapeHtml(e.description)} ${money(e.amount)}</p>`).join("")}
      </body></html>`;
    const popup = window.open("", "_blank");
    if (!popup) return;
    popup.document.write(html);
    popup.document.close();
    popup.print();
  }

  return (
    <div className="mt-6 flex gap-3">
      <button onClick={pdf} className="rounded-full bg-[#0B6E4F] px-4 py-2 text-white">
        Download PDF
      </button>
      <button onClick={excel} className="rounded-full border px-4 py-2">
        Download Excel
      </button>
    </div>
  );
}
