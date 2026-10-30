"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/ui/primitives";

type Promo = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  discount_type: string;
  percent_off?: number | null;
  amount_off?: number | null;
  min_order_amount?: number | null;
  is_active: boolean;
  ends_at?: string | null;
  usage_count?: number;
  customer_segment?: string;
};

export function PromoCodeAdminForm({
  codes,
  levels,
  scope,
}: {
  codes: Promo[];
  levels: { id: string; name: string }[];
  scope: "platform" | "shop";
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const endpoint = scope === "platform" ? "/api/admin/loyalty" : "/api/shop/loyalty";

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_promo",
        code: form.get("code"),
        name: form.get("name"),
        description: form.get("description"),
        discount_type: form.get("discount_type"),
        percent_off: form.get("percent_off"),
        amount_off: form.get("amount_off"),
        min_order_amount: form.get("min_order_amount"),
        max_discount: form.get("max_discount"),
        starts_at: form.get("starts_at") || null,
        ends_at: form.get("ends_at") || null,
        total_usage_limit: form.get("total_usage_limit") || null,
        per_customer_limit: form.get("per_customer_limit") || 1,
        customer_segment: form.get("customer_segment"),
        loyalty_only: form.get("loyalty_only") === "on",
        is_active: true,
        required_loyalty_level_id: form.get("required_loyalty_level_id") || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Unable to save this code.");
    else {
      event.currentTarget.reset();
      router.refresh();
    }
  }

  return (
    <div className="grid gap-6">
      <form onSubmit={save} className="lg-card grid gap-3 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="code" required placeholder="PROMO CODE" className="rounded-xl border px-3 py-2 uppercase" />
          <input name="name" required placeholder="Promotion name" className="rounded-xl border px-3 py-2" />
        </div>
        <textarea name="description" placeholder="Description" className="rounded-xl border px-3 py-2" />
        <div className="grid gap-3 sm:grid-cols-3">
          <select name="discount_type" className="rounded-xl border px-3 py-2" defaultValue="percent">
            <option value="percent">Percentage</option>
            <option value="fixed">Fixed amount</option>
            <option value="free_delivery">Free delivery</option>
          </select>
          <input name="percent_off" type="number" min={1} max={100} placeholder="% off" className="rounded-xl border px-3 py-2" />
          <input name="amount_off" type="number" min={0.01} step="0.01" placeholder="$ off" className="rounded-xl border px-3 py-2" />
          <input name="min_order_amount" type="number" min={0} step="0.01" placeholder="Min order" className="rounded-xl border px-3 py-2" />
          <input name="max_discount" type="number" min={0} step="0.01" placeholder="Max discount" className="rounded-xl border px-3 py-2" />
          <input name="total_usage_limit" type="number" min={1} placeholder="Total uses" className="rounded-xl border px-3 py-2" />
          <input name="per_customer_limit" type="number" min={1} defaultValue={1} className="rounded-xl border px-3 py-2" />
          <select name="customer_segment" className="rounded-xl border px-3 py-2" defaultValue="all">
            <option value="all">All customers</option>
            <option value="new">New customers only</option>
            <option value="existing">Existing customers only</option>
            <option value="loyalty">Loyalty members</option>
            <option value="level">Specific level</option>
          </select>
          <select name="required_loyalty_level_id" className="rounded-xl border px-3 py-2">
            <option value="">Any level</option>
            {levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.name}
              </option>
            ))}
          </select>
          <input name="starts_at" type="datetime-local" className="rounded-xl border px-3 py-2" />
          <input name="ends_at" type="datetime-local" className="rounded-xl border px-3 py-2" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input name="loyalty_only" type="checkbox" /> Loyalty-only
        </label>
        <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Create promo code</button>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </form>
      <div className="grid gap-3">
        {codes.map((code) => (
          <article key={code.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4">
            <div>
              <p className="font-mono font-semibold text-[#0B6E4F]">{code.code}</p>
              <p className="text-sm">{code.name}</p>
              <p className="text-xs text-[var(--lagecto-muted)]">
                {code.discount_type} · {code.usage_count || 0} uses · ends {formatDate(code.ends_at || null)}
              </p>
            </div>
            <StatusBadge value={code.is_active ? "active" : "inactive"} />
          </article>
        ))}
      </div>
    </div>
  );
}
