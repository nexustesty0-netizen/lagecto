"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ShopRewardForm() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/shop/loyalty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_reward",
        name: form.get("name"),
        description: form.get("description"),
        reward_type: form.get("reward_type"),
        value: form.get("value"),
        order_threshold: form.get("order_threshold"),
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
    <form onSubmit={save} className="lg-card mb-4 grid gap-3 p-5 sm:grid-cols-2">
      <input name="name" required placeholder="Reward name" className="rounded-xl border px-3 py-2" />
      <select name="reward_type" className="rounded-xl border px-3 py-2" defaultValue="percent_discount">
        <option value="percent_discount">Percentage discount</option>
        <option value="fixed_discount">Fixed discount</option>
        <option value="free_delivery">Free delivery</option>
      </select>
      <input name="value" type="number" min={0} step="0.01" placeholder="Value" className="rounded-xl border px-3 py-2" />
      <input name="order_threshold" type="number" min={1} defaultValue={2} placeholder="Orders required" className="rounded-xl border px-3 py-2" />
      <textarea name="description" placeholder="Description" className="rounded-xl border px-3 py-2 sm:col-span-2" />
      <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white sm:col-span-2">Create shop reward</button>
      {error ? <p className="text-sm text-red-700 sm:col-span-2">{error}</p> : null}
    </form>
  );
}
