"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SHOP_PROVIDER_TYPES } from "@/lib/brand";
import { CategorySelect } from "@/components/ui/CategoryIcon";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";
import Link from "next/link";

type ShopRow = {
  id: string;
  name: string;
  login_shop_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  status: string;
  verification_status: string;
  category: string | null;
  provider_type: string | null;
  phone: string | null;
};

type PlanOption = {
  id: string;
  name: string;
  package_key: string | null;
  duration_key?: string | null;
  duration_months?: number | null;
  price?: number | null;
};

export function ShopManageClient({ shops, plans }: { shops: ShopRow[]; plans: PlanOption[] }) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function call(payload: Record<string, unknown>) {
    setError("");
    const response = await fetch("/api/admin/shops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Unable to update this shop.");
    else router.refresh();
  }

  return (
    <div className="grid gap-3">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {shops.map((shop) => (
        <article key={shop.id} className="grid gap-3 rounded-2xl bg-white p-4 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{shop.name}</p>
              <VerifiedBadge verified={shop.verification_status === "verified"} />
            </div>
            <p className="font-mono text-sm">{shop.login_shop_id}</p>
            <Link href={`/admin/shops/${shop.id}`} className="text-xs font-semibold text-[#0B6E4F]">
              Feature access
            </Link>
            <p className="text-xs text-[#6B7280]">
              {shop.owner_name} · {shop.owner_email}
            </p>
            <p className="text-xs text-[#0B6E4F]">
              {shop.provider_type === "products"
                ? "Products only"
                : shop.provider_type === "services"
                  ? "Services only"
                  : "Products and services"}
            </p>
          </div>
          <select
            defaultValue={shop.status}
            className="rounded-xl border px-3 py-2 text-sm"
            onChange={(event) => call({ action: "update", shopId: shop.id, status: event.target.value })}
          >
            <option value="active">active</option>
            <option value="inactive">suspended</option>
            <option value="pending">pending</option>
          </select>
          <select
            defaultValue=""
            className="rounded-xl border px-3 py-2 text-sm"
            onChange={(event) => event.target.value && call({ action: "assign_plan", shopId: shop.id, planId: event.target.value })}
          >
            <option value="">Assign package (verifies shop)…</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} · {plan.package_key || "custom"} · {plan.duration_key || `${plan.duration_months || 1} mo`}
                {plan.price != null ? ` · $${Number(plan.price)}` : ""}
              </option>
            ))}
          </select>
          <form
            className="lg:col-span-4 grid gap-2 md:grid-cols-5"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              call({
                action: "update",
                shopId: shop.id,
                name: form.get("name"),
                phone: form.get("phone"),
                category: form.get("category"),
                providerType: form.get("providerType"),
                about: form.get("about"),
              });
            }}
          >
            <input name="name" defaultValue={shop.name} className="rounded-xl border px-3 py-2" />
            <input name="phone" defaultValue={shop.phone || ""} placeholder="Phone" className="rounded-xl border px-3 py-2" />
            <CategorySelect name="category" defaultValue={shop.category || "other"} />
            <select name="providerType" defaultValue={shop.provider_type || "both"} className="rounded-xl border px-3 py-2">
              {SHOP_PROVIDER_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Save shop</button>
          </form>
        </article>
      ))}
    </div>
  );
}
