"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Badge = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  audience: string;
  category: string;
  rarity: string;
  icon: string;
  is_active: boolean;
  is_visible: boolean;
};

export function BadgeAdminClient({ badges }: { badges: Badge[] }) {
  const router = useRouter();
  const [audience, setAudience] = useState("customer");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [grant, setGrant] = useState({ userId: "", badgeId: "", reason: "" });
  const filtered = useMemo(
    () =>
      badges.filter((badge) => badge.audience === audience && (!query || `${badge.name} ${badge.slug}`.toLowerCase().includes(query.toLowerCase()))),
    [audience, badges, query],
  );

  async function save(badge: Badge, patch: Partial<Badge>) {
    setError("");
    const res = await fetch("/api/admin/loyalty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_badge", id: badge.id, ...patch }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Unable to save.");
    else router.refresh();
  }

  async function grantBadge(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const res = await fetch("/api/admin/loyalty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "grant_badge", ...grant }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Unable to grant.");
    else {
      setGrant({ userId: "", badgeId: "", reason: "" });
      router.refresh();
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap gap-2">
        {["customer", "shop"].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setAudience(key)}
            className={`rounded-full px-4 py-2 text-sm ${audience === key ? "bg-[#0B6E4F] text-white" : "border bg-white"}`}
          >
            {key} ({badges.filter((b) => b.audience === key).length})
          </button>
        ))}
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="rounded-full border px-4 py-2 text-sm" />
      </div>
      <form onSubmit={grantBadge} className="lg-card grid gap-3 p-4 sm:grid-cols-4">
        <input required value={grant.userId} onChange={(e) => setGrant({ ...grant, userId: e.target.value })} placeholder="Customer user ID" className="rounded-xl border px-3 py-2" />
        <select required value={grant.badgeId} onChange={(e) => setGrant({ ...grant, badgeId: e.target.value })} className="rounded-xl border px-3 py-2">
          <option value="">Badge</option>
          {badges.filter((b) => b.audience === "customer").map((badge) => (
            <option key={badge.id} value={badge.id}>
              {badge.name}
            </option>
          ))}
        </select>
        <input required value={grant.reason} onChange={(e) => setGrant({ ...grant, reason: e.target.value })} placeholder="Reason (required)" className="rounded-xl border px-3 py-2" />
        <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Grant with audit</button>
      </form>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="grid gap-3">
        {filtered.map((badge) => (
          <article key={badge.id} className="lg-card grid gap-3 p-4 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="font-semibold">{badge.name}</p>
              <p className="text-sm text-[var(--lagecto-muted)]">{badge.slug} · {badge.category} · {badge.rarity}</p>
              <p className="mt-1 text-sm">{badge.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded-full border px-3 py-1 text-sm" onClick={() => void save(badge, { is_active: !badge.is_active })}>
                {badge.is_active ? "Deactivate" : "Activate"}
              </button>
              <button type="button" className="rounded-full border px-3 py-1 text-sm" onClick={() => void save(badge, { is_visible: !badge.is_visible })}>
                {badge.is_visible ? "Hide" : "Show"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
