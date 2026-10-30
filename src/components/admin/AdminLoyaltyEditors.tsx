"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLoyaltyEditors() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function save(action: string, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/admin/loyalty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        slug: form.get("slug"),
        name: form.get("name"),
        description: form.get("description"),
        rank: form.get("rank"),
        min_points: form.get("min_points"),
        discount_percent: form.get("discount_percent"),
        reward_type: form.get("reward_type"),
        value: form.get("value"),
        requirements: form.get("metric")
          ? { all: [{ metric: String(form.get("metric")), gte: Number(form.get("threshold") || 1) }] }
          : {},
      }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Unable to save.");
    else {
      event.currentTarget.reset();
      router.refresh();
    }
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <form onSubmit={(event) => void save("save_level", event)} className="lg-card grid gap-3 p-5">
        <h2 className="font-semibold">Loyalty level</h2>
        <input name="name" required placeholder="Level name" className="rounded-xl border px-3 py-2" />
        <input name="slug" required placeholder="slug" className="rounded-xl border px-3 py-2" />
        <input name="rank" type="number" min={1} defaultValue={1} className="rounded-xl border px-3 py-2" />
        <input name="min_points" type="number" min={0} defaultValue={0} className="rounded-xl border px-3 py-2" />
        <input name="discount_percent" type="number" min={0} max={100} defaultValue={0} className="rounded-xl border px-3 py-2" />
        <textarea name="description" placeholder="Benefits / description" className="rounded-xl border px-3 py-2" />
        <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Save level</button>
      </form>
      <form onSubmit={(event) => void save("save_reward", event)} className="lg-card grid gap-3 p-5">
        <h2 className="font-semibold">Platform reward</h2>
        <input name="name" required placeholder="Reward name" className="rounded-xl border px-3 py-2" />
        <select name="reward_type" className="rounded-xl border px-3 py-2" defaultValue="percent_discount">
          <option value="percent_discount">Percentage discount</option>
          <option value="fixed_discount">Fixed discount</option>
          <option value="free_delivery">Free delivery</option>
        </select>
        <input name="value" type="number" min={0} step="0.01" placeholder="Value" className="rounded-xl border px-3 py-2" />
        <input name="metric" defaultValue="completed_orders" className="rounded-xl border px-3 py-2" />
        <input name="threshold" type="number" min={1} defaultValue={1} className="rounded-xl border px-3 py-2" />
        <textarea name="description" placeholder="Description" className="rounded-xl border px-3 py-2" />
        <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Save reward</button>
      </form>
      {error ? <p className="text-sm text-red-700 lg:col-span-2">{error}</p> : null}
    </div>
  );
}
