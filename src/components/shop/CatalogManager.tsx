"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MediaField } from "@/components/media/MediaField";
import { MediaPreview } from "@/components/media/MediaPreview";
import { allowsCatalogDeviceImageUpload, isStoredCatalogImage, validateVideoUrl } from "@/lib/media";
import { catalogDeviceImageLimit, catalogDeviceImageMessage, type PackageKey } from "@/lib/packages";
import { catalogPriceLabel } from "@/lib/storefront/catalog-display";
import type { Product } from "@/lib/types";
import { availabilityLabel, normalizeAvailability } from "@/lib/product-availability";
import { CategoryIcon, ServiceIconPicker } from "@/components/ui/CategoryIcon";

type CatalogRow = Product & { duration?: string | null; video_url?: string | null };

function CatalogThumb({
  kind,
  image,
  icon,
  category,
}: {
  kind: "product" | "service";
  image?: string | null;
  icon?: string | null;
  category?: string | null;
}) {
  if (image) {
    return <MediaPreview url={image} title="" className="h-12 w-12 shrink-0 rounded-xl" interactive={false} fit="cover" />;
  }
  if (kind === "service" && (icon || category)) {
    return (
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#E8F4EE] text-[#0B6E4F]">
        <CategoryIcon slug={icon || category} className="h-6 w-6" />
      </span>
    );
  }
  return <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#F3EEE0] text-xs">—</span>;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      {hint ? <span className="text-xs font-normal text-[var(--lagecto-muted)]">{hint}</span> : null}
      {children}
    </label>
  );
}

export function CatalogManager({
  shopId,
  kind,
  items,
  categories,
  soldById = {},
  packageKey = "free",
  deviceImageUsed = 0,
}: {
  shopId: string;
  kind: "product" | "service";
  items: CatalogRow[];
  categories: { id: string; name: string }[];
  soldById?: Record<string, number>;
  packageKey?: PackageKey;
  deviceImageUsed?: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<Partial<CatalogRow> | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CatalogRow | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const hay = `${item.name} ${item.category || ""} ${item.barcode || ""}`.toLowerCase();
      if (q && !hay.includes(q)) return false;
      const stock = Number(item.stock || 0);
      const threshold = Number(item.low_stock_threshold || 0);
      if (filter === "listed") return item.is_available;
      if (filter === "hidden") return !item.is_available;
      if (filter === "low") return kind === "product" && stock > 0 && stock <= threshold;
      if (filter === "out") return kind === "product" && stock <= 0 && normalizeAvailability(item.availability) !== "on_order";
      if (filter === "on_order") return kind === "product" && normalizeAvailability(item.availability) === "on_order";
      if (filter.startsWith("cat:")) return (item.category || "") === filter.slice(4);
      return true;
    });
  }, [items, query, filter, kind]);

  const selectedIds = items.filter((item) => selected[item.id]).map((item) => item.id);
  const deviceImageLimit = catalogDeviceImageLimit(packageKey);
  const originalImage = editing?.id ? items.find((item) => item.id === editing.id)?.image : null;
  const quotaUrl = isStoredCatalogImage(imageUrl) ? imageUrl : originalImage;
  const canUploadDeviceImage = allowsCatalogDeviceImageUpload({
    limit: deviceImageLimit,
    used: deviceImageUsed,
    currentUrl: quotaUrl,
  });
  const quotaCopy = catalogDeviceImageMessage(packageKey);

  function openNew() {
    setError("");
    setImageUrl(null);
    setVideoUrl("");
    setEditing({
      shop_id: shopId,
      type: kind,
      name: "",
      description: "",
      category: "",
      duration: "",
      barcode: "",
      availability: "available",
      is_available: true,
      is_popular: false,
      low_stock_threshold: 5,
    });
  }

  function openEdit(item: CatalogRow) {
    setError("");
    setImageUrl(item.image);
    setVideoUrl(item.video_url || "");
    setEditing({ ...item });
  }

  async function save() {
    if (!editing?.name) {
      setError("Name is required.");
      return;
    }
    if (Number(editing.price || 0) < 0) {
      setError("Price cannot be negative.");
      return;
    }
    let savedVideo: string | null = videoUrl.trim() || null;
    if (savedVideo) {
      const video = validateVideoUrl(savedVideo);
      if (!video.ok) {
        setError(video.error);
        return;
      }
      savedVideo = video.source.href;
    }
    setBusy(true);
    const supabase = createBrowserSupabase();
    const payload = {
      shop_id: shopId,
      type: kind,
      name: String(editing.name).trim(),
      price: Number(editing.price || 0),
      cost: kind === "product" ? Number(editing.cost || 0) : 0,
      description: editing.description || "",
      category: editing.category || null,
      duration: String(editing.duration || "").trim() || null,
      image: imageUrl || null,
      video_url: savedVideo,
      barcode: String(editing.barcode || "").trim() || null,
      low_stock_threshold: kind === "product" ? Number(editing.low_stock_threshold || 0) || 5 : null,
      availability: kind === "product" ? normalizeAvailability(editing.availability) : "available",
      is_available: Boolean(editing.is_available),
      is_popular: Boolean(editing.is_popular),
      icon: kind === "service" ? editing.icon || null : null,
      updated_at: new Date().toISOString(),
    };
    let productId = editing.id || "";
    if (editing.id) {
      let { error: updateError } = await supabase.from("products").update(payload).eq("id", editing.id).eq("shop_id", shopId);
      if (updateError && "icon" in payload) {
        const { icon: _icon, ...withoutIcon } = payload;
        updateError = (await supabase.from("products").update(withoutIcon).eq("id", editing.id).eq("shop_id", shopId)).error;
      }
      if (updateError) {
        setBusy(false);
        setError("Unable to save this item.");
        return;
      }
    } else {
      let { data, error: insertError } = await supabase
        .from("products")
        .insert({ ...payload, stock: kind === "product" ? 0 : null })
        .select("id")
        .maybeSingle();
      if (insertError && "icon" in payload) {
        const { icon: _icon, ...withoutIcon } = payload;
        const retry = await supabase
          .from("products")
          .insert({ ...withoutIcon, stock: kind === "product" ? 0 : null })
          .select("id")
          .maybeSingle();
        data = retry.data;
        insertError = retry.error;
      }
      if (insertError || !data) {
        setBusy(false);
        setError("Unable to add this item.");
        return;
      }
      productId = data.id;
      const opening = kind === "product" ? Number(editing.stock || 0) : 0;
      if (opening > 0) {
        const res = await fetch("/api/shop/inventory/adjust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId, kind: "in", quantity: opening, reason: "restock", notes: "Opening stock" }),
        });
        if (!res.ok) {
          setBusy(false);
          setError("Product saved. Opening stock could not be recorded — adjust it in Inventory.");
          setEditing(null);
          router.refresh();
          return;
        }
      }
    }
    if (imageUrl && productId) {
      await supabase.from("product_images").delete().eq("product_id", productId);
      await supabase.from("product_images").insert({
        product_id: productId,
        shop_id: shopId,
        url: imageUrl,
        is_primary: true,
        source: imageUrl.startsWith("http") ? "url" : "upload",
        sort_order: 0,
      });
    }
    setBusy(false);
    setEditing(null);
    router.refresh();
  }

  async function duplicate(item: CatalogRow) {
    const copyImage =
      isStoredCatalogImage(item.image) &&
      !allowsCatalogDeviceImageUpload({ limit: deviceImageLimit, used: deviceImageUsed, currentUrl: null })
        ? null
        : item.image;
    const supabase = createBrowserSupabase();
    const { error: insertError } = await supabase.from("products").insert({
      shop_id: shopId,
      type: kind,
      name: `${item.name} copy`,
      price: item.price,
      cost: kind === "product" ? item.cost : 0,
      stock: kind === "product" ? 0 : null,
      description: item.description,
      category: item.category,
      duration: item.duration,
      barcode: item.barcode ? `${item.barcode}-copy` : null,
      low_stock_threshold: item.low_stock_threshold,
      availability: kind === "product" ? normalizeAvailability(item.availability) : "available",
      image: copyImage,
      icon: item.icon || null,
      is_available: false,
      is_popular: false,
    });
    if (insertError) setError("Unable to duplicate this item.");
    else router.refresh();
  }

  async function toggleAvailable(item: CatalogRow) {
    const supabase = createBrowserSupabase();
    await supabase.from("products").update({ is_available: !item.is_available }).eq("id", item.id).eq("shop_id", shopId);
    router.refresh();
  }

  async function bulk(action: "hide" | "list" | "delete") {
    if (!selectedIds.length) return;
    const supabase = createBrowserSupabase();
    if (action === "delete") {
      await supabase.from("products").delete().eq("shop_id", shopId).in("id", selectedIds);
    } else {
      await supabase.from("products").update({ is_available: action === "list" }).eq("shop_id", shopId).in("id", selectedIds);
    }
    setSelected({});
    setPendingDelete(null);
    router.refresh();
  }

  async function remove() {
    if (!pendingDelete) return;
    const supabase = createBrowserSupabase();
    await supabase.from("products").delete().eq("id", pendingDelete.id).eq("shop_id", shopId);
    setPendingDelete(null);
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={kind === "product" ? "Search name, category or SKU" : "Search services"}
          className="w-full max-w-sm rounded-xl border px-3 py-2"
        />
        <button type="button" onClick={openNew} className="rounded-full bg-[#0B6E4F] px-4 py-2 text-sm font-semibold text-white">
          + Add {kind}
        </button>
      </div>
      <p className="text-sm text-[var(--lagecto-muted)]">
        {deviceImageLimit == null ? quotaCopy : `${deviceImageUsed} of ${deviceImageLimit} device photos used. ${quotaCopy}`}
      </p>
      <div className="flex flex-wrap gap-2">
        {[
          ["all", "All"],
          ["listed", "Listed"],
          ["hidden", "Hidden"],
          ...(kind === "product"
            ? [
                ["low", "Low stock"],
                ["out", "Out of stock"],
                ["on_order", "On order"],
              ]
            : []),
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-full px-3 py-1.5 text-sm ${filter === value ? "bg-[#0B6E4F] text-white" : "border border-[var(--lagecto-border)] bg-white"}`}
          >
            {label}
          </button>
        ))}
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setFilter(`cat:${category.name}`)}
            className={`rounded-full px-3 py-1.5 text-sm ${filter === `cat:${category.name}` ? "bg-[#0B6E4F] text-white" : "border border-[var(--lagecto-border)] bg-white"}`}
          >
            {category.name}
          </button>
        ))}
      </div>
      {selectedIds.length ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>{selectedIds.length} selected</span>
          <button type="button" className="rounded-full border px-3 py-1.5" onClick={() => void bulk("list")}>
            List
          </button>
          <button type="button" className="rounded-full border px-3 py-1.5" onClick={() => void bulk("hide")}>
            Hide
          </button>
          <button type="button" className="rounded-full border border-red-200 px-3 py-1.5 text-red-700" onClick={() => setPendingBulkDelete(true)}>
            Delete
          </button>
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="grid gap-2 md:hidden">
        {filtered.map((item) => (
          <article key={item.id} className="flex items-center gap-3 rounded-2xl border border-[var(--lagecto-border)] bg-white p-3">
            <CatalogThumb kind={kind} image={item.image} icon={item.icon} category={item.category} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{item.name}</p>
              <p className="text-xs text-[var(--lagecto-muted)]">
                {kind === "product"
                  ? `${catalogPriceLabel(item.price)} · ${availabilityLabel(item.availability)}${normalizeAvailability(item.availability) === "available" ? ` · ${item.stock ?? 0} in stock` : ""}`
                  : `${catalogPriceLabel(item.price)}${item.duration ? ` · ${item.duration}` : ""}`}
              </p>
            </div>
            <button type="button" onClick={() => openEdit(item)} className="text-sm font-semibold text-[#0B6E4F]">
              Edit
            </button>
          </article>
        ))}
        {!filtered.length ? <p className="px-1 text-sm text-[var(--lagecto-muted)]">No {kind}s yet.</p> : null}
      </div>
      <div className="app-table-wrap hidden md:block">
        <table className="app-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && filtered.every((item) => selected[item.id])}
                  onChange={(event) => {
                    const next: Record<string, boolean> = { ...selected };
                    for (const item of filtered) next[item.id] = event.target.checked;
                    setSelected(next);
                  }}
                  aria-label="Select all visible"
                />
              </th>
              <th>Image</th>
              <th>{kind === "service" ? "Service" : "Product"}</th>
              {kind === "product" ? <th>SKU</th> : null}
              <th>Price</th>
              {kind === "product" ? <th>Stock</th> : <th>Delivery</th>}
              {kind === "product" ? <th>Sold</th> : null}
              {kind === "product" ? <th>For orders</th> : null}
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={Boolean(selected[item.id])}
                    onChange={(event) => setSelected((current) => ({ ...current, [item.id]: event.target.checked }))}
                    aria-label={`Select ${item.name}`}
                  />
                </td>
                <td>
                  <CatalogThumb kind={kind} image={item.image} icon={item.icon} category={item.category} />
                </td>
                <td>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-[var(--lagecto-muted)]">{item.category || "Uncategorised"}</p>
                </td>
                {kind === "product" ? <td>{item.barcode || "—"}</td> : null}
                <td>{catalogPriceLabel(item.price)}</td>
                <td>{kind === "product" ? item.stock ?? 0 : item.duration || "—"}</td>
                {kind === "product" ? <td>{soldById[item.id] || 0}</td> : null}
                {kind === "product" ? <td>{availabilityLabel(item.availability)}</td> : null}
                <td>{item.is_available ? "Listed" : "Hidden"}</td>
                <td>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <button type="button" onClick={() => openEdit(item)} className="font-medium text-[#0B6E4F]">
                      Edit
                    </button>
                    <button type="button" onClick={() => void duplicate(item)} className="text-[var(--lagecto-muted)]">
                      Duplicate
                    </button>
                    <button type="button" onClick={() => void toggleAvailable(item)} className="text-[var(--lagecto-muted)]">
                      {item.is_available ? "Hide" : "List"}
                    </button>
                    <button type="button" onClick={() => setPendingDelete(item)} className="text-[#C2413B]">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-[#12241c]/40 p-4 backdrop-blur-sm">
          <form
            className="lg-card mx-auto my-8 grid max-w-2xl gap-3 p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <div>
              <h2 className="text-lg font-semibold">{editing.id ? `Edit ${kind}` : `Add ${kind}`}</h2>
              <p className="mt-1 text-sm font-normal text-[var(--lagecto-muted)]">
                {kind === "service"
                  ? "Add a price if you have one. Empty prices show “Contact shop for pricing”."
                  : "Stock changes after create are recorded in Inventory, not overwritten here."}
              </p>
            </div>
            <Field label={kind === "service" ? "Service name" : "Product name"} hint="The name customers will see.">
              <input
                required
                value={editing.name || ""}
                onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                placeholder={kind === "service" ? "e.g. Haircut" : "e.g. 5kg rice"}
                className="rounded-xl border px-3 py-2 font-normal"
              />
            </Field>
            <div className={`grid gap-3 ${kind === "product" ? "sm:grid-cols-2" : ""}`}>
              <Field
                label={kind === "product" ? "Selling price" : "Price"}
                hint="What the customer pays. Leave empty to show “Contact shop for pricing”."
              >
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={editing.price ?? ""}
                  onChange={(event) => setEditing({ ...editing, price: event.target.value === "" ? undefined : Number(event.target.value) })}
                  placeholder="0.00"
                  className="rounded-xl border px-3 py-2 font-normal"
                />
              </Field>
              {kind === "product" ? (
                <Field label="Cost price" hint="What it costs you. Used for inventory value.">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={editing.cost ?? ""}
                    onChange={(event) => setEditing({ ...editing, cost: event.target.value === "" ? undefined : Number(event.target.value) })}
                    placeholder="0.00"
                    className="rounded-xl border px-3 py-2 font-normal"
                  />
                </Field>
              ) : null}
            </div>
            {kind === "product" ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="SKU / barcode" hint="Optional. Used at POS search.">
                    <input
                      value={editing.barcode || ""}
                      onChange={(event) => setEditing({ ...editing, barcode: event.target.value })}
                      placeholder="SKU or barcode"
                      className="rounded-xl border px-3 py-2 font-normal"
                    />
                  </Field>
                  <Field label="Low-stock alert" hint="Inventory warns at this quantity.">
                    <input
                      type="number"
                      min={0}
                      value={editing.low_stock_threshold ?? 5}
                      onChange={(event) => setEditing({ ...editing, low_stock_threshold: Number(event.target.value || 0) })}
                      className="rounded-xl border px-3 py-2 font-normal"
                    />
                  </Field>
                </div>
                <fieldset className="grid gap-2 rounded-2xl border border-[var(--lagecto-border)] p-3">
                  <legend className="px-1 text-sm font-medium">For customer orders</legend>
                  <label className="flex items-start gap-2 rounded-xl bg-[#F7F3E3] p-3 text-sm font-normal">
                    <input
                      type="radio"
                      className="mt-1"
                      name="availability"
                      checked={normalizeAvailability(editing.availability) === "available"}
                      onChange={() => setEditing({ ...editing, availability: "available" })}
                    />
                    <span>
                      <span className="font-medium">Available now</span>
                      <span className="mt-0.5 block text-xs text-[var(--lagecto-muted)]">Customers order from stock you already have.</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 rounded-xl bg-[#F7F3E3] p-3 text-sm font-normal">
                    <input
                      type="radio"
                      className="mt-1"
                      name="availability"
                      checked={normalizeAvailability(editing.availability) === "on_order"}
                      onChange={() => setEditing({ ...editing, availability: "on_order" })}
                    />
                    <span>
                      <span className="font-medium">Available on order</span>
                      <span className="mt-0.5 block text-xs text-[var(--lagecto-muted)]">You prepare or source it after they order.</span>
                    </span>
                  </label>
                </fieldset>
              </>
            ) : null}
            {kind === "product" ? (
              editing.id ? (
                <p className="text-sm text-[var(--lagecto-muted)]">
                  On hand: {editing.stock ?? 0}. Change stock in Inventory so the movement is recorded.
                </p>
              ) : (
                <Field label="Opening stock" hint="Recorded as a restock when you save.">
                  <input
                    type="number"
                    min={0}
                    value={editing.stock ?? ""}
                    onChange={(event) => setEditing({ ...editing, stock: event.target.value === "" ? undefined : Number(event.target.value) })}
                    placeholder="0"
                    className="rounded-xl border px-3 py-2 font-normal"
                  />
                </Field>
              )
            ) : (
              <Field label="Icon" hint="Shown on the storefront when this service has no photo.">
                <ServiceIconPicker
                  value={editing.icon}
                  onChange={(slug) => setEditing({ ...editing, icon: slug })}
                />
              </Field>
            )}
            <Field
              label={kind === "service" ? "Estimated completion" : "Average delivery"}
              hint={
                kind === "service"
                  ? "Shown on the service details page. Leave empty to show “Timeframe provided on enquiry”."
                  : "Shown on the storefront for this item. Leave empty to use the shop delivery time."
              }
            >
              <input
                value={editing.duration || ""}
                onChange={(event) => setEditing({ ...editing, duration: event.target.value })}
                placeholder="e.g. 2–3 days"
                className="rounded-xl border px-3 py-2 font-normal"
              />
            </Field>
            <Field label="Category" hint="Helps you group this with similar items.">
              {categories.length ? (
                <select
                  value={editing.category || ""}
                  onChange={(event) => setEditing({ ...editing, category: event.target.value })}
                  className="rounded-xl border px-3 py-2 font-normal"
                >
                  <option value="">Choose a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={editing.category || ""}
                  onChange={(event) => setEditing({ ...editing, category: event.target.value })}
                  placeholder="e.g. Groceries"
                  className="rounded-xl border px-3 py-2 font-normal"
                />
              )}
            </Field>
            <Field label="Description" hint="Optional extra detail for the storefront.">
              <textarea
                value={editing.description || ""}
                onChange={(event) => setEditing({ ...editing, description: event.target.value })}
                placeholder={kind === "service" ? "What this service includes" : "What this product is"}
                className="min-h-24 rounded-xl border px-3 py-2 font-normal"
              />
            </Field>
            <MediaField
              label="Image"
              purpose="product"
              value={imageUrl}
              onChange={setImageUrl}
              allowUpload={canUploadDeviceImage}
              quotaUrl={quotaUrl}
              hint={
                canUploadDeviceImage
                  ? "Upload from your device, or paste an HTTPS image URL."
                  : "Device photo limit reached. Paste an HTTPS image URL, or remove a stored photo first."
              }
            />
            <MediaField
              label="Video (optional)"
              purpose="video"
              value={videoUrl || null}
              onChange={(url) => setVideoUrl(url || "")}
              hint="Paste a Facebook, Instagram, YouTube, or TikTok URL. Videos cannot be uploaded from this device."
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={Boolean(editing.is_available)} onChange={(event) => setEditing({ ...editing, is_available: event.target.checked })} />
              Listed on storefront
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={Boolean(editing.is_popular)} onChange={(event) => setEditing({ ...editing, is_popular: event.target.checked })} />
              Featured on storefront
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded-full border px-4 py-2">
                Cancel
              </button>
              <button disabled={busy} className="rounded-full bg-[#0B6E4F] px-4 py-2 text-white disabled:opacity-60">
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Delete ${kind}?`}
        body="This cannot be undone. Orders that already used this item keep their snapshots."
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void remove()}
      />
      <ConfirmDialog
        open={pendingBulkDelete}
        title={`Delete ${selectedIds.length} ${kind}s?`}
        body="This cannot be undone. Existing orders keep their item snapshots."
        onCancel={() => setPendingBulkDelete(false)}
        onConfirm={() => {
          setPendingBulkDelete(false);
          void bulk("delete");
        }}
      />
    </div>
  );
}
