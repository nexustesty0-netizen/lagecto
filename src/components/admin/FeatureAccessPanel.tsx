"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TOGGLEABLE_FEATURES } from "@/lib/features";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { featuresForPackage, FEATURE_LABELS, type PackageKey } from "@/lib/packages";

export function FeatureAccessPanel({
  shopId,
  packageKey,
  enabled,
  disabled,
}: {
  shopId: string;
  packageKey: PackageKey;
  enabled: string[];
  disabled: string[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState<{ key: string; enabled: boolean } | null>(null);
  const pack = featuresForPackage(packageKey);
  const on = new Set(enabled);
  const off = new Set(disabled);

  async function apply(key: string, next: boolean) {
    setError("");
    const res = await fetch("/api/admin/features", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopId, feature: key, enabled: next }),
    });
    const data = await res.json();
    setPending(null);
    if (!res.ok) setError(data.error || "Unable to update this feature.");
    else router.refresh();
  }

  return (
    <section className="os-surface">
      <p className="os-kicker">Shop feature access</p>
      <h2 className="mt-1 text-lg font-semibold">Turn tools on or off for this shop</h2>
      <p className="mt-2 text-sm text-[var(--lagecto-muted)]">
        A disabled feature stays in history. Package rules still apply — turning a tool on cannot grant access the package does not include.
      </p>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      <div className="mt-4 grid gap-3">
        {TOGGLEABLE_FEATURES.map((feature) => {
          const inPackage = pack.has(feature.key);
          const currentlyOn = inPackage && !off.has(feature.key) && on.has(feature.key);
          return (
            <label key={feature.key} className="flex items-start justify-between gap-4 rounded-2xl border border-[var(--lagecto-border)] px-4 py-3">
              <span>
                <span className="block font-semibold">{feature.label}</span>
                <span className="block text-sm text-[var(--lagecto-muted)]">{feature.description}</span>
                {!inPackage ? (
                  <span className="mt-1 block text-xs text-[var(--lagecto-muted)]">Not included in {packageKey}.</span>
                ) : null}
              </span>
              <input
                type="checkbox"
                disabled={!inPackage}
                checked={currentlyOn}
                onChange={(event) => setPending({ key: feature.key, enabled: event.target.checked })}
              />
            </label>
          );
        })}
      </div>
      <ConfirmDialog
        open={Boolean(pending)}
        title={pending?.enabled ? `Enable ${FEATURE_LABELS[pending?.key || ""] || pending?.key}?` : `Disable ${FEATURE_LABELS[pending?.key || ""] || pending?.key}?`}
        body="Existing records are kept. The shop will not be able to use a disabled feature from the menu, a direct URL, or the API."
        confirmLabel={pending?.enabled ? "Enable" : "Disable"}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && apply(pending.key, pending.enabled)}
      />
    </section>
  );
}
