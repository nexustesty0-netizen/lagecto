"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MediaField } from "@/components/media/MediaField";
import { formatDate } from "@/lib/format";

type Ad = {
  id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  ad_type: string;
  destination_kind: string;
  destination_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  impressions: number;
  clicks: number;
};

export function AdsManager({ ads }: { ads: Ad[] }) {
  const router = useRouter();
  const [image, setImage] = useState<string | null>(null);
  const [pending, setPending] = useState<Ad | null>(null);
  const [error, setError] = useState("");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const starts = String(form.get("starts_at") || "") || null;
    const ends = String(form.get("ends_at") || "") || null;
    if (starts && ends && new Date(ends) < new Date(starts)) {
      setError("End date must be after the start date.");
      return;
    }
    const supabase = createBrowserSupabase();
    const { error: insertError } = await supabase.from("marketplace_ads").insert({
      title: String(form.get("title") || "").trim(),
      body: String(form.get("body") || ""),
      image_url: image,
      ad_type: String(form.get("ad_type") || "banner"),
      destination_kind: String(form.get("destination_kind") || "marketplace"),
      destination_id: String(form.get("destination_id") || "") || null,
      starts_at: starts,
      ends_at: ends,
      is_active: true,
    });
    if (insertError) setError("Unable to save this ad.");
    else {
      event.currentTarget.reset();
      setImage(null);
      setError("");
      router.refresh();
    }
  }

  async function toggle(ad: Ad) {
    const supabase = createBrowserSupabase();
    await supabase.from("marketplace_ads").update({ is_active: !ad.is_active }).eq("id", ad.id);
    router.refresh();
  }

  async function remove() {
    if (!pending) return;
    const supabase = createBrowserSupabase();
    await supabase.from("marketplace_ads").delete().eq("id", pending.id);
    setPending(null);
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <form onSubmit={save} className="lg-card grid gap-3 p-5 md:grid-cols-2">
        <input name="title" required placeholder="Ad title" className="rounded-xl border px-3 py-2 md:col-span-2" />
        <textarea name="body" placeholder="Short message" className="min-h-20 rounded-xl border px-3 py-2 md:col-span-2" />
        <select name="ad_type" className="rounded-xl border px-3 py-2">
          <option value="banner">Promotional banner</option>
          <option value="featured_shop">Featured shop</option>
          <option value="featured_product">Featured product</option>
          <option value="sponsored">Sponsored placement</option>
        </select>
        <select name="destination_kind" className="rounded-xl border px-3 py-2">
          <option value="marketplace">Marketplace home</option>
          <option value="shop">Shop storefront</option>
          <option value="product">Product</option>
          <option value="promotion">Promotion</option>
          <option value="category">Category</option>
        </select>
        <input name="destination_id" placeholder="Shop slug, product id, or category" className="rounded-xl border px-3 py-2 md:col-span-2" />
        <input name="starts_at" type="datetime-local" className="rounded-xl border px-3 py-2" />
        <input name="ends_at" type="datetime-local" className="rounded-xl border px-3 py-2" />
        <div className="md:col-span-2">
          <MediaField label="Banner" purpose="ad" value={image} onChange={setImage} />
        </div>
        <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white md:col-span-2">Create ad</button>
        {error ? <p className="text-sm text-red-600 md:col-span-2">{error}</p> : null}
      </form>
      {ads.map((ad) => (
        <article key={ad.id} className="lg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{ad.title}</p>
              <p className="text-sm text-[var(--lagecto-muted)]">
                {ad.ad_type.replace("_", " ")} → {ad.destination_kind}
                {ad.starts_at ? ` · ${formatDate(ad.starts_at)}` : ""}
              </p>
              <p className="mt-1 text-xs text-[var(--lagecto-muted)]">
                {ad.impressions} impressions · {ad.clicks} clicks
              </p>
            </div>
            <div className="flex gap-2 text-sm">
              <button type="button" className="text-[#0B6E4F]" onClick={() => void toggle(ad)}>
                {ad.is_active ? "Deactivate" : "Activate"}
              </button>
              <button type="button" className="text-[#C2413B]" onClick={() => setPending(ad)}>
                Delete
              </button>
            </div>
          </div>
        </article>
      ))}
      <ConfirmDialog open={Boolean(pending)} title="Delete this ad?" body="It will be removed from the marketplace." onCancel={() => setPending(null)} onConfirm={() => void remove()} />
    </div>
  );
}
