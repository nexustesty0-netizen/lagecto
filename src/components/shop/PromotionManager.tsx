"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MediaField } from "@/components/media/MediaField";
import { money, formatDate } from "@/lib/format";

type Promo = {
  id: string;
  title: string;
  description?: string | null;
  discount: number | null;
  expiry_date: string | null;
  image: string | null;
  is_active: boolean;
  is_featured?: boolean | null;
  product_id: string | null;
  promo_price: number | null;
  original_price: number | null;
  starts_at: string | null;
  ends_at: string | null;
};

export function PromotionManager({
  shopId,
  promotions,
  catalog,
}: {
  shopId: string;
  promotions: Promo[];
  catalog: { id: string; name: string; price: number; type: string }[];
}) {
  const router = useRouter();
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Promo | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const productId = String(form.get("product_id") || "") || null;
    const promoPriceRaw = String(form.get("promo_price") || "");
    const discountRaw = String(form.get("discount") || "");
    const promoPrice = promoPriceRaw === "" ? null : Number(promoPriceRaw);
    const discount = discountRaw === "" ? null : Number(discountRaw);
    const product = catalog.find((item) => item.id === productId);
    if (promoPrice != null && promoPrice < 0) {
      setError("Prices cannot be negative.");
      return;
    }
    if (discount != null && (discount < 0 || discount > 100)) {
      setError("Discount must be between 0 and 100.");
      return;
    }
    if (promoPrice != null && product && promoPrice >= product.price) {
      setError("Promotion price must be lower than the product price.");
      return;
    }
    const starts = String(form.get("starts_at") || "") || null;
    const ends = String(form.get("ends_at") || "") || null;
    if (starts && ends && new Date(ends) < new Date(starts)) {
      setError("End date must be after the start date.");
      return;
    }
    const supabase = createBrowserSupabase();
    const { error: insertError } = await supabase.from("promotions").insert({
      shop_id: shopId,
      title: String(form.get("title") || "").trim(),
      description: String(form.get("description") || "").trim() || null,
      discount,
      product_id: productId,
      promo_price: promoPrice,
      original_price: product?.price ?? null,
      starts_at: starts,
      ends_at: ends,
      expiry_date: ends ? ends.slice(0, 10) : null,
      image,
      is_active: true,
      is_featured: form.get("is_featured") === "on",
    });
    if (insertError) setError("Unable to create this promotion. Check prices and dates.");
    else {
      event.currentTarget.reset();
      setImage(null);
      setError("");
      router.refresh();
    }
  }

  async function toggle(row: Promo) {
    const supabase = createBrowserSupabase();
    await supabase.from("promotions").update({ is_active: !row.is_active }).eq("id", row.id).eq("shop_id", shopId);
    router.refresh();
  }

  async function remove() {
    if (!pending) return;
    const supabase = createBrowserSupabase();
    await supabase.from("promotions").delete().eq("id", pending.id).eq("shop_id", shopId);
    setPending(null);
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <form onSubmit={save} className="lg-card grid gap-3 p-5 md:grid-cols-2">
        <input name="title" required placeholder="Promotion name" className="rounded-xl border px-3 py-2 md:col-span-2" />
        <textarea name="description" placeholder="Description" className="min-h-20 rounded-xl border px-3 py-2 md:col-span-2" />
        <select name="product_id" className="rounded-xl border px-3 py-2">
          <option value="">Whole shop (% off)</option>
          {catalog.map((item) => (
            <option key={item.id} value={item.id}>
              {item.type === "service" ? "Service" : "Product"} · {item.name} · {money(item.price)}
            </option>
          ))}
        </select>
        <input name="discount" type="number" min={0} max={100} step="0.01" placeholder="Percentage discount" className="rounded-xl border px-3 py-2" />
        <input name="promo_price" type="number" min={0} step="0.01" placeholder="Fixed sale price (optional)" className="rounded-xl border px-3 py-2" />
        <input name="starts_at" type="datetime-local" className="rounded-xl border px-3 py-2" />
        <input name="ends_at" type="datetime-local" className="rounded-xl border px-3 py-2" />
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" name="is_featured" />
          Featured promotion on storefront
        </label>
        <div className="md:col-span-2">
          <MediaField label="Banner image" purpose="media" value={image} onChange={setImage} hint="Upload a photo, or paste an image or Instagram / TikTok / Facebook / YouTube link." />
        </div>
        <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white md:col-span-2">Create promotion</button>
        {error ? <p className="text-sm text-red-600 md:col-span-2">{error}</p> : null}
      </form>
      {promotions.map((row) => {
        const original = Number(row.original_price || 0);
        const sale = Number(row.promo_price || 0);
        const pct = row.discount != null ? Number(row.discount) : original && sale ? Math.round(((original - sale) / original) * 100) : null;
        return (
          <article key={row.id} className="lg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {row.title}
                  {row.is_featured ? <span className="ml-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#D4AF37]">Featured</span> : null}
                </p>
                <p className="text-sm text-[var(--lagecto-muted)]">
                  {pct != null ? `${pct}% off` : "Promotion"}
                  {row.promo_price != null ? ` · ${money(row.promo_price)}` : ""}
                  {row.expiry_date ? ` · until ${formatDate(row.expiry_date)}` : ""}
                  {row.is_active ? "" : " · inactive"}
                </p>
                {row.description ? <p className="mt-1 text-sm">{row.description}</p> : null}
              </div>
              <div className="flex gap-2 text-sm">
                <button type="button" onClick={() => void toggle(row)} className="text-[#0B6E4F]">
                  {row.is_active ? "Deactivate" : "Activate"}
                </button>
                <button type="button" onClick={() => setPending(row)} className="text-[#C2413B]">
                  Delete
                </button>
              </div>
            </div>
          </article>
        );
      })}
      <ConfirmDialog open={Boolean(pending)} title="Delete this promotion?" body="It will stop appearing in the marketplace and storefront." onCancel={() => setPending(null)} onConfirm={() => void remove()} />
    </div>
  );
}
