"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MediaField } from "@/components/media/MediaField";
import { CategorySelect } from "@/components/ui/CategoryIcon";
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

export type AdShopOption = {
  id: string;
  name: string;
  slug: string | null;
  banner_url: string | null;
  logo_url: string | null;
};

export type AdProductOption = {
  id: string;
  name: string;
  image: string | null;
  shop_id: string;
  shop_name: string;
  shop_slug: string | null;
  shop_banner: string | null;
};

export type AdPromoOption = {
  id: string;
  title: string;
  image: string | null;
  shop_name: string;
  shop_slug: string | null;
};

type PromoteKind = "shop" | "product" | "promotion" | "category" | "marketplace";

function kindFromAd(adType: string, destinationKind: string): PromoteKind {
  if (adType === "featured_shop" || destinationKind === "shop") return "shop";
  if (adType === "featured_product" || destinationKind === "product") return "product";
  if (destinationKind === "promotion") return "promotion";
  if (destinationKind === "category") return "category";
  return "marketplace";
}

export function AdsManager({
  ads,
  shops,
  products,
  promotions,
}: {
  ads: Ad[];
  shops: AdShopOption[];
  products: AdProductOption[];
  promotions: AdPromoOption[];
}) {
  const router = useRouter();
  const [image, setImage] = useState<string | null>(null);
  const [kind, setKind] = useState<PromoteKind>("shop");
  const [shopKey, setShopKey] = useState("");
  const [productId, setProductId] = useState("");
  const [promoId, setPromoId] = useState("");
  const [pending, setPending] = useState<Ad | null>(null);
  const [error, setError] = useState("");

  const selectedShop = useMemo(
    () => shops.find((shop) => shop.slug === shopKey || shop.id === shopKey) || null,
    [shops, shopKey],
  );
  const selectedProduct = useMemo(() => products.find((item) => item.id === productId) || null, [products, productId]);
  const selectedPromo = useMemo(() => promotions.find((item) => item.id === promoId) || null, [promotions, promoId]);
  const preview =
    image ||
    (kind === "shop" ? selectedShop?.banner_url || selectedShop?.logo_url : null) ||
    (kind === "product" ? selectedProduct?.image || selectedProduct?.shop_banner : null) ||
    (kind === "promotion" ? selectedPromo?.image : null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const starts = String(form.get("starts_at") || "") || null;
    const ends = String(form.get("ends_at") || "") || null;
    if (starts && ends && new Date(ends) < new Date(starts)) {
      setError("End date must be after the start date.");
      return;
    }

    let destinationKind = "marketplace";
    let destinationId: string | null = null;
    let adType = "banner";
    if (kind === "shop") {
      if (!selectedShop) {
        setError("Choose the shop this ad should open.");
        return;
      }
      destinationKind = "shop";
      destinationId = selectedShop.slug || selectedShop.id;
      adType = "featured_shop";
    } else if (kind === "product") {
      if (!selectedProduct) {
        setError("Choose the product this ad should open.");
        return;
      }
      destinationKind = "product";
      destinationId = selectedProduct.id;
      adType = "featured_product";
    } else if (kind === "promotion") {
      if (!selectedPromo) {
        setError("Choose the promotion this ad should open.");
        return;
      }
      destinationKind = "promotion";
      destinationId = selectedPromo.id;
      adType = "sponsored";
    } else if (kind === "category") {
      destinationKind = "category";
      destinationId = String(form.get("category") || "other");
      adType = "banner";
    }

    const supabase = createBrowserSupabase();
    const { error: insertError } = await supabase.from("marketplace_ads").insert({
      title: String(form.get("title") || "").trim(),
      body: String(form.get("body") || ""),
      image_url: image,
      ad_type: adType,
      destination_kind: destinationKind,
      destination_id: destinationId,
      starts_at: starts,
      ends_at: ends,
      is_active: true,
    });
    if (insertError) setError("Unable to save this ad.");
    else {
      formEl.reset();
      setImage(null);
      setKind("shop");
      setShopKey("");
      setProductId("");
      setPromoId("");
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
        <label className="grid gap-1 text-sm md:col-span-2">
          <span className="text-[var(--lagecto-muted)]">What should people visit?</span>
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as PromoteKind)}
            className="rounded-xl border px-3 py-2"
          >
            <option value="shop">A shop — uses the shop banner</option>
            <option value="product">A product — uses the product photo</option>
            <option value="promotion">A shop promotion</option>
            <option value="category">A marketplace category</option>
            <option value="marketplace">Marketplace home</option>
          </select>
        </label>
        {kind === "shop" ? (
          <label className="grid gap-1 text-sm md:col-span-2">
            <span className="text-[var(--lagecto-muted)]">Shop</span>
            <select value={shopKey} onChange={(event) => setShopKey(event.target.value)} className="rounded-xl border px-3 py-2">
              <option value="">Choose a shop…</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.slug || shop.id}>
                  {shop.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {kind === "product" ? (
          <label className="grid gap-1 text-sm md:col-span-2">
            <span className="text-[var(--lagecto-muted)]">Product</span>
            <select value={productId} onChange={(event) => setProductId(event.target.value)} className="rounded-xl border px-3 py-2">
              <option value="">Choose a product…</option>
              {products.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.shop_name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {kind === "promotion" ? (
          <label className="grid gap-1 text-sm md:col-span-2">
            <span className="text-[var(--lagecto-muted)]">Promotion</span>
            <select value={promoId} onChange={(event) => setPromoId(event.target.value)} className="rounded-xl border px-3 py-2">
              <option value="">Choose a promotion…</option>
              {promotions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} · {item.shop_name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {kind === "category" ? (
          <div className="md:col-span-2">
            <CategorySelect name="category" defaultValue="other" />
          </div>
        ) : null}
        <input name="starts_at" type="datetime-local" className="rounded-xl border px-3 py-2" />
        <input name="ends_at" type="datetime-local" className="rounded-xl border px-3 py-2" />
        <div className="md:col-span-2">
          <MediaField
            label="Custom image (optional)"
            purpose="ad"
            value={image}
            onChange={setImage}
            hint={
              kind === "shop"
                ? "Leave empty to use the shop’s banner."
                : kind === "product"
                  ? "Leave empty to use the product photo."
                  : "Optional banner image."
            }
          />
        </div>
        {preview ? (
          <div className="overflow-hidden rounded-xl md:col-span-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" className="h-40 w-full object-cover" />
            <p className="mt-2 text-xs text-[var(--lagecto-muted)]">
              {image ? "Custom image" : kind === "shop" ? "Shop banner" : kind === "product" ? "Product photo" : "Preview"}
            </p>
          </div>
        ) : null}
        <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white md:col-span-2">Create ad</button>
        {error ? <p className="text-sm text-red-600 md:col-span-2">{error}</p> : null}
      </form>
      {ads.map((ad) => (
        <article key={ad.id} className="lg-card overflow-hidden p-0">
          {ad.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ad.image_url} alt="" className="h-28 w-full object-cover" />
          ) : null}
          <div className="flex flex-wrap items-start justify-between gap-3 p-4">
            <div>
              <p className="font-semibold">{ad.title}</p>
              <p className="text-sm text-[var(--lagecto-muted)]">
                {kindFromAd(ad.ad_type, ad.destination_kind).replace("_", " ")} → {ad.destination_kind}
                {ad.destination_id ? ` · ${ad.destination_id}` : ""}
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
      <ConfirmDialog
        open={Boolean(pending)}
        title="Delete this ad?"
        body="It will be removed from the marketplace, shops, news and customer pages."
        onCancel={() => setPending(null)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
