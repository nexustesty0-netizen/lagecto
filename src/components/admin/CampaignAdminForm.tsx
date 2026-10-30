"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/ui/primitives";

type Campaign = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  kind: string;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  max_enrollments: number | null;
  enrollment_count: number;
  benefit: Record<string, unknown> | null;
};

export function CampaignAdminForm({ campaigns }: { campaigns: Campaign[] }) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/admin/loyalty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_campaign",
        id: String(form.get("id") || "") || undefined,
        slug: form.get("slug"),
        name: form.get("name"),
        description: form.get("description"),
        kind: form.get("kind"),
        is_active: form.get("is_active") === "on",
        starts_at: form.get("starts_at") || null,
        ends_at: form.get("ends_at") || null,
        max_enrollments: form.get("max_enrollments") || null,
        benefit: {
          package_key: form.get("package_key") || "thabi",
          duration_months: Number(form.get("duration_months") || 3),
          listing: "free_for_3_months",
        },
        eligibility: { include_customers: form.get("include_customers") === "on", shop_must_be_new: true },
      }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Unable to save.");
    else router.refresh();
  }

  return (
    <div className="grid gap-6">
      <form onSubmit={save} className="lg-card grid gap-3 p-5">
        <input type="hidden" name="id" />
        <input name="name" required placeholder="Campaign name" className="rounded-xl border px-3 py-2" defaultValue="Founding Users" />
        <input name="slug" required placeholder="slug" className="rounded-xl border px-3 py-2" defaultValue="founding-users" />
        <textarea name="description" placeholder="Description" className="min-h-24 rounded-xl border px-3 py-2" />
        <div className="grid gap-3 sm:grid-cols-2">
          <select name="kind" className="rounded-xl border px-3 py-2" defaultValue="founding_users">
            <option value="founding_users">Founding users</option>
            <option value="loyalty">Loyalty</option>
            <option value="promotion">Promotion</option>
            <option value="seasonal">Seasonal</option>
          </select>
          <select name="package_key" className="rounded-xl border px-3 py-2" defaultValue="thabi">
            <option value="thabi">Thabi</option>
            <option value="kristen">Kristen</option>
            <option value="sandra">Sandra</option>
          </select>
          <input name="duration_months" type="number" min={1} defaultValue={3} className="rounded-xl border px-3 py-2" />
          <input name="max_enrollments" type="number" min={1} placeholder="Max shops" className="rounded-xl border px-3 py-2" />
          <input name="starts_at" type="datetime-local" className="rounded-xl border px-3 py-2" />
          <input name="ends_at" type="datetime-local" className="rounded-xl border px-3 py-2" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input name="is_active" type="checkbox" defaultChecked /> Active
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input name="include_customers" type="checkbox" defaultChecked /> Award Early Adopter to customers who register in-window
        </label>
        <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Save campaign</button>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </form>
      <div className="grid gap-3">
        {campaigns.map((campaign) => (
          <article key={campaign.id} className="rounded-2xl bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">{campaign.name}</p>
              <StatusBadge value={campaign.is_active ? "active" : "inactive"} />
            </div>
            <p className="text-sm text-[var(--lagecto-muted)]">
              {campaign.kind} · {campaign.enrollment_count} enrolled
              {campaign.max_enrollments ? ` / ${campaign.max_enrollments}` : ""} · ends {formatDate(campaign.ends_at)}
            </p>
            <p className="mt-1 text-sm">{campaign.description}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
