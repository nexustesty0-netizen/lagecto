"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { money } from "@/lib/format";
import {
  DURATION_KEYS,
  DURATION_LABELS,
  DURATION_MONTHS,
  FEATURE_LABELS,
  PACKAGE_FEATURES,
  PACKAGE_META,
  PACKAGE_THEME,
  PAID_PACKAGE_KEYS,
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
  const [pendingDelete, setPendingDelete] = useState<Plan | null>(null);
  const [showCreate, setShowCreate] = useState(false);

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
      setShowCreate(false);
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

  const grouped = useMemo(() => {
    const byKey = new Map<string, Plan[]>();
    for (const plan of plans) {
      const key = plan.package_key || "other";
      const list = byKey.get(key) || [];
      list.push(plan);
      byKey.set(key, list);
    }
    const known = PAID_PACKAGE_KEYS.map((key) => ({
      key,
      plans: (byKey.get(key) || []).slice().sort((a, b) => Number(a.duration_months || 0) - Number(b.duration_months || 0)),
    }));
    const extras = [...byKey.entries()]
      .filter(([key]) => !PAID_PACKAGE_KEYS.includes(key as (typeof PAID_PACKAGE_KEYS)[number]))
      .map(([key, rows]) => ({ key, plans: rows }));
    return [...known, ...extras];
  }, [plans]);

  return (
    <div className="grid gap-6">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Catalog</h2>
          <p className="text-sm text-[var(--lagecto-muted)]">Grouped by package. Each duration is its own price.</p>
        </div>
        <button type="button" className="rounded-full bg-[#0B6E4F] px-4 py-2 text-sm font-semibold text-white" onClick={() => setShowCreate((value) => !value)}>
          {showCreate ? "Close form" : "Create package"}
        </button>
      </div>

      {showCreate ? (
        <form
          className="grid gap-3 rounded-[24px] border border-[var(--lagecto-border)] bg-white p-4 sm:p-5 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            call({ action: "upsert", ...fieldsFrom(new FormData(event.currentTarget)) });
            event.currentTarget.reset();
          }}
        >
          <h3 className="font-semibold md:col-span-2">New package price</h3>
          <label className="grid gap-1 text-sm">
            Name
            <input name="name" placeholder="Thabi" className="rounded-xl border px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm">
            Slug
            <input name="slug" placeholder="thabi-6-months" className="rounded-xl border px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm">
            Package
            <select name="packageKey" className="rounded-xl border px-3 py-2">
              <option value="thabi">Thabi</option>
              <option value="kristen">Kristen</option>
              <option value="sandra">Sandra</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Duration
            <select name="durationKey" className="rounded-xl border px-3 py-2">
              {DURATION_KEYS.map((key) => (
                <option key={key} value={key}>
                  {DURATION_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Price
            <input name="price" type="number" step="0.01" required placeholder="0.00" className="rounded-xl border px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm">
            Trial days
            <input name="trialDays" type="number" defaultValue={14} className="rounded-xl border px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm">
            Promo price
            <input name="promoPrice" type="number" step="0.01" placeholder="Optional" className="rounded-xl border px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm">
            Promo label
            <input name="promoLabel" placeholder="Launch offer" className="rounded-xl border px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm md:col-span-2">
            Description
            <textarea name="description" placeholder="What this plan includes" className="min-h-20 rounded-xl border px-3 py-2" />
          </label>
          <input name="displayOrder" type="hidden" defaultValue={0} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isTrialAvailable" defaultChecked /> Trial available
          </label>
          <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white md:col-span-2">Create package</button>
        </form>
      ) : null}

      {grouped.map((group) => {
        const key = group.key;
        const meta = key in PACKAGE_META ? PACKAGE_META[key as PackageKey] : { name: group.key, tagline: "Custom", description: "" };
        const theme = key in PACKAGE_THEME ? PACKAGE_THEME[key as PackageKey] : PACKAGE_THEME.free;
        return (
          <section key={group.key} className="overflow-hidden rounded-[24px] border border-[var(--lagecto-border)] bg-white shadow-[var(--lg-shadow)]">
            <div className="flex flex-wrap items-end justify-between gap-3 px-4 py-4 sm:px-5" style={{ background: theme.wash }}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: theme.ink }}>
                  {meta.tagline}
                </p>
                <h3 className="mt-1 text-xl font-semibold">{meta.name}</h3>
              </div>
              <p className="text-sm text-[var(--lagecto-muted)]">{group.plans.length} duration{group.plans.length === 1 ? "" : "s"}</p>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
              {group.plans.length ? (
                group.plans.map((plan) => (
                  <article key={plan.id} className="rounded-2xl border border-[var(--lagecto-border)] bg-[#fffdf8] p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-[var(--lagecto-muted)]">
                          {DURATION_LABELS[(plan.duration_key as keyof typeof DURATION_LABELS) || "1_month"] || `${plan.duration_months || 1} mo`}
                        </p>
                        <p className="mt-1 text-xl font-semibold" style={{ color: theme.accent }}>
                          {money(plan.promo_price ?? plan.price)}
                        </p>
                        {plan.promo_price ? <p className="text-xs text-[var(--lagecto-muted)] line-through">{money(plan.price)}</p> : null}
                      </div>
                      <span className={`badge ${plan.is_active ? "bg-emerald-50 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>
                        {plan.is_active ? "Active" : "Off"}
                      </span>
                    </div>
                    {plan.promo_label ? <p className="mt-2 text-xs font-semibold text-[#D4AF37]">{plan.promo_label}</p> : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className="rounded-lg border px-3 py-1 text-sm" onClick={() => setEditing(editing === plan.id ? null : plan.id)}>
                        {editing === plan.id ? "Close" : "Edit"}
                      </button>
                      <button type="button" className="rounded-lg border px-3 py-1 text-sm" onClick={() => call({ action: "toggle", id: plan.id, isActive: !plan.is_active })}>
                        {plan.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <button type="button" className="rounded-lg border border-red-200 px-3 py-1 text-sm text-[#C2413B]" onClick={() => setPendingDelete(plan)}>
                        Delete
                      </button>
                    </div>
                    {editing === plan.id ? (
                      <form
                        className="mt-4 grid gap-3 border-t pt-4"
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
                          {DURATION_KEYS.map((duration) => (
                            <option key={duration} value={duration}>
                              {DURATION_LABELS[duration]}
                            </option>
                          ))}
                        </select>
                        <input name="price" type="number" step="0.01" defaultValue={plan.price} className="rounded-xl border px-3 py-2" />
                        <input name="trialDays" type="number" defaultValue={plan.trial_days || 14} className="rounded-xl border px-3 py-2" />
                        <input name="promoPrice" type="number" step="0.01" defaultValue={plan.promo_price || ""} placeholder="Promo price" className="rounded-xl border px-3 py-2" />
                        <input name="promoLabel" defaultValue={plan.promo_label || ""} placeholder="Promo label" className="rounded-xl border px-3 py-2" />
                        <input name="displayOrder" type="number" defaultValue={plan.display_order || 0} className="rounded-xl border px-3 py-2" />
                        <textarea name="description" defaultValue={plan.description || ""} className="min-h-20 rounded-xl border px-3 py-2" />
                        <div className="grid gap-1">
                          <p className="text-sm font-medium">Features</p>
                          <div className="grid max-h-40 gap-1 overflow-y-auto sm:grid-cols-2">
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
                        <p className="text-xs text-[var(--lagecto-muted)]">
                          Saving updates the catalog only. Existing shop subscriptions keep the price that applied when they were assigned.
                        </p>
                        <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Save changes</button>
                      </form>
                    ) : null}
                  </article>
                ))
              ) : (
                <p className="text-sm text-[var(--lagecto-muted)] sm:col-span-2 xl:col-span-3">No durations in this package yet.</p>
              )}
            </div>
          </section>
        );
      })}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this plan?"
        body="This removes the plan from the catalog. Shops already on it keep their current subscription and price."
        confirmLabel="Delete plan"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const id = pendingDelete?.id;
          setPendingDelete(null);
          if (id) void call({ action: "delete", id });
        }}
      />
    </div>
  );
}
