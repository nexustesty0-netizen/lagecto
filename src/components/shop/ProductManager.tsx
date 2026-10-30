"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function ProductManager({
  shopId,
  providerType = "both",
}: {
  shopId: string;
  providerType?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const supabase = createBrowserSupabase();
    const { error: insertError } = await supabase.from("products").insert({
      shop_id: shopId,
      name: String(form.get("name") || ""),
      price: Number(form.get("price") || 0),
      cost: Number(form.get("cost") || 0),
      stock: Number(form.get("stock") || 0),
      type: String(form.get("type") || (providerType === "services" ? "service" : "product")),
      description: String(form.get("description") || ""),
    });
    if (insertError) setError("Unable to add this product.");
    else {
      event.currentTarget.reset();
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl bg-white p-4 md:grid-cols-6">
      <input name="name" required placeholder="Name" className="rounded-xl border px-3 py-2 md:col-span-2" />
      <input name="price" type="number" step="0.01" required placeholder="Price" className="rounded-xl border px-3 py-2" />
      <input name="cost" type="number" step="0.01" placeholder="Cost" className="rounded-xl border px-3 py-2" />
      <input name="stock" type="number" placeholder="Stock" className="rounded-xl border px-3 py-2" />
      {providerType === "both" ? (
        <select name="type" className="rounded-xl border px-3 py-2">
          <option value="product">Product</option>
          <option value="service">Service</option>
        </select>
      ) : (
        <input type="hidden" name="type" value={providerType === "services" ? "service" : "product"} />
      )}
      <input name="description" placeholder="Description" className="rounded-xl border px-3 py-2 md:col-span-5" />
      <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Add</button>
      {error ? <p className="md:col-span-6 text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
