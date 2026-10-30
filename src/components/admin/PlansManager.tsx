"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  DURATION_KEYS,
  DURATION_LABELS,
  DURATION_MONTHS,
  FEATURE_LABELS,
  PACKAGE_FEATURES,
  PACKAGE_META,
  normalizePackageKey,
  type PackageKey,
} from "@/lib/packages";

type Plan = {
  id: string;
  name: string;
  slug: string | null;
  package_key: string | null;
  duration_key?: string | null;
  price: number;
  promo_price?: number | null;
  promo_label?: string | null;
  billing_period: string | null;
  duration_months: number | null;
  trial_days: number | null;
  is_trial_available?: boolean | null;
  is_active: boolean;
  description?: string | null;
  display_order?: number | null;
  features?: string[] | null;
};

export function PlansManager({ plans }: { plans: Plan[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  async function call(payload: Record<string, unknown>) {
    setError("");
    const response = await fetch("/api/admin/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Unable to save this plan.");
    else {
      setEditing(null);
      router.refresh();
    }
  }

  function fieldsFrom(form: FormData, existing?: Plan) {
    const packageKey = normalizePackageKey(String(form.get("packageKey") || existing?.package_key || "thabi"));
    const durationKey = String(form.get("durationKey") || existing?.duration_key || "1_month");
    const durationMonths = DURATION_MONTHS[durationKey as keyof typeof DURATION_MONTHS] || 1;
    const selectedFeatures = form.getAll("features").map(String);
    return {
      name: form.get("name") || PACKAGE_META[packageKey === "free" ? "thabi" : packageKey].name,
      slug: form.get("slug"),
      packageKey: packageKey === "free" ? "thabi" : packageKey,
      durationKey,
      price: Number(form.get("price") || 0),
      promoPrice: form.get("promoPrice") ? Number(form.get("promoPrice")) : null,
      promoLabel: String(form.get("promoLabel") || ""),
      billingPeriod: durationMonths >= 12 ? "yearly" : "monthly",
      durationMonths,
      trialDays: Number(form.get("trialDays") || 14),
      isTrialAvailable: form.get("isTrialAvailable") === "on",
      description: String(form.get("description") || ""),
      displayOrder: Number(form.get("displayOrder") || 0),
      features: selectedFeatures.length ? selectedFeatures : [...PACKAGE_FEATURES[packageKey as PackageKey]],
      isActive: form.get("isActive") ? form.get("isActive") === "on" : existing?.is_active !== false,
    };
  }

  return (
    <div className="grid gap-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <form
        className="grid gap-3 rounded-2xl bg-white p-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          call({ action: "upsert", ...fieldsFrom(new FormData(event.currentTarget)) });
          event.currentTarget.reset();
        }}
      >
        <h2 className="font-semibold md:col-span-2">Create package</h2>
        <input name="name" placeholder="Plan name" className="rounded-xl border px-3 py-2" />
        <input name="slug" placeholder="slug" className="rounded-xl border px-3 py-2" />
        <select name="packageKey" className="rounded-xl border px-3 py-2">
          <option value="thabi">Thabi</option>
          <option value="kristen">Kristen</option>
          <option value="sandra">Sandra</option>
        </select>
        <select name="durationKey" className="rounded-xl border px-3 py-2">
          {DURATION_KEYS.map((key) => (
            <option key={key} value={key}>
              {DURATION_LABELS[key]}
            </option>
          ))}
        </select>
        <input name="price" type="number" step="0.01" required placeholder="Price" className="rounded-xl border px-3 py-2" />
        <input name="trialDays" type="number" defaultValue={14} className="rounded-xl border px-3 py-2" />
        <input name="promoPrice" type="number" step="0.01" placeholder="Promotional price" className="rounded-xl border px-3 py-2" />
        <input name="promoLabel" placeholder="Promo label" className="rounded-xl border px-3 py-2" />
        <input name="displayOrder" type="number" defaultValue={0} className="rounded-xl border px-3 py-2" />
        <textarea name="description" placeholder="Description" className="min-h-20 rounded-xl border px-3 py-2 md:col-span-2" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isTrialAvailable" defaultChecked /> Trial available
        </label>
        <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white md:col-span-2">Create package</button>
      </form>
      <div className="grid gap-3">
        {plans.map((plan) => (
          <article key={plan.id} className="rounded-2xl bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{plan.name}</p>
                <p className="text-sm text-[#0B6E4F]">
                  ${Number(plan.price)}
                  {plan.promo_price ? ` · promo $${plan.promo_price}` : ""} · {plan.duration_key || `${plan.duration_months || 1} mo`}
                </p>
                <p className="text-xs text-[#6B7280]">
                  {plan.package_key} · {plan.is_active ? "active" : "inactive"} · order {plan.display_order || 0}
                </p>
                {plan.description ? <p className="mt-2 text-sm text-[#6B7280]">{plan.description}</p> : null}
              </div>
              <div className="flex gap-2">
                <button type="button" className="rounded-lg border px-3 py-1 text-sm" onClick={() => setEditing(editing === plan.id ? null : plan.id)}>
                  Edit
                </button>
                <button type="button" className="rounded-lg border px-3 py-1 text-sm" onClick={() => call({ action: "toggle", id: plan.id, isActive: !plan.is_active })}>
                  {plan.is_active ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
            {editing === plan.id ? (
              <form
                className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  call({ action: "upsert", id: plan.id, ...fieldsFrom(new FormData(event.currentTarget), plan) });
                }}
              >
                <input name="name" defaultValue={plan.name} className="rounded-xl border px-3 py-2" />
                <input name="slug" defaultValue={plan.slug || ""} className="rounded-xl border px-3 py-2" />
                <select name="packageKey" defaultValue={plan.package_key || "thabi"} className="rounded-xl border px-3 py-2">
                  <option value="thabi">Thabi</option>
                  <option value="kristen">Kristen</option>
                  <option value="sandra">Sandra</option>
                </select>
                <select name="durationKey" defaultValue={plan.duration_key || "1_month"} className="rounded-xl border px-3 py-2">
                  {DURATION_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {DURATION_LABELS[key]}
                    </option>
                  ))}
                </select>
                <input name="price" type="number" step="0.01" defaultValue={plan.price} className="rounded-xl border px-3 py-2" />
                <input name="trialDays" type="number" defaultValue={plan.trial_days || 14} className="rounded-xl border px-3 py-2" />
                <input name="promoPrice" type="number" step="0.01" defaultValue={plan.promo_price || ""} placeholder="Promo price" className="rounded-xl border px-3 py-2" />
                <input name="promoLabel" defaultValue={plan.promo_label || ""} placeholder="Promo label" className="rounded-xl border px-3 py-2" />
                <input name="displayOrder" type="number" defaultValue={plan.display_order || 0} className="rounded-xl border px-3 py-2" />
                <textarea name="description" defaultValue={plan.description || ""} className="min-h-20 rounded-xl border px-3 py-2 md:col-span-2" />
                <div className="grid gap-1 md:col-span-2">
                  <p className="text-sm font-medium">Features</p>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {Object.keys(FEATURE_LABELS).map((feature) => (
                      <label key={feature} className="flex items-center gap-2 text-xs">
                        <input type="checkbox" name="features" value={feature} defaultChecked={(plan.features || []).includes(feature)} />
                        {FEATURE_LABELS[feature]}
                      </label>
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="isTrialAvailable" defaultChecked={plan.is_trial_available !== false} /> Trial available
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="isActive" defaultChecked={plan.is_active} /> Active
                </label>
                <p className="text-xs text-[var(--lagecto-muted)] md:col-span-2">
                  Saving updates the catalog only. Existing shop subscriptions keep the price that applied when they were assigned.
                </p>
                <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Save changes</button>
              </form>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
