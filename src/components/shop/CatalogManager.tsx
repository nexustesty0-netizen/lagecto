"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MediaField } from "@/components/media/MediaField";
import { MediaPreview } from "@/components/media/MediaPreview";
import { money } from "@/lib/format";
import type { Product } from "@/lib/types";

type CatalogRow = Product & { duration?: string | null; video_url?: string | null };

export function CatalogManager({
  shopId,
  kind,
  items,
  categories,
}: {
  shopId: string;
  kind: "product" | "service";
  items: CatalogRow[];
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
    const [query, setQuery] = useState("");
    const [editing, setEditing] = useState<Partial<CatalogRow> | null>(null);
    const [pendingDelete, setPendingDelete] = useState<CatalogRow | null>(null);
    const [error, setError] = useState("");
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => !q || item.name.toLowerCase().includes(q) || (item.category || "").toLowerCase().includes(q));
  }, [items, query]);

  function openNew() {
    setError("");
    setImageUrl(null);
    setVideoUrl("");
    setEditing({
      shop_id: shopId,
      type: kind,
      name: "",
      price: 0,
      cost: 0,
      stock: kind === "product" ? 0 : null,
      description: "",
      category: "",
      duration: "",
      is_available: true,
      is_popular: false,
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
    if (Number(editing.price) < 0) {
      setError("Price cannot be negative.");
      return;
    }
    const supabase = createBrowserSupabase();
    const payload = {
      shop_id: shopId,
      type: kind,
      name: String(editing.name).trim(),
      price: Number(editing.price || 0),
      cost: Number(editing.cost || 0),
      stock: kind === "product" ? Number(editing.stock || 0) : null,
      description: editing.description || "",
      category: editing.category || null,
      duration: kind === "service" ? editing.duration || null : null,
      image: imageUrl || null,
      video_url: videoUrl.trim() || null,
      is_available: Boolean(editing.is_available),
      is_popular: Boolean(editing.is_popular),
      updated_at: new Date().toISOString(),
    };
    if (editing.id) {
      const { error: updateError } = await supabase.from("products").update(payload).eq("id", editing.id).eq("shop_id", shopId);
      if (updateError) {
        setError("Unable to save this item.");
        return;
      }
      if (imageUrl) {
        await supabase.from("product_images").delete().eq("product_id", editing.id);
        await supabase.from("product_images").insert({
          product_id: editing.id,
          shop_id: shopId,
          url: imageUrl,
          is_primary: true,
          source: imageUrl.startsWith("http") ? "url" : "upload",
          sort_order: 0,
        });
      }
    } else {
      const { data, error: insertError } = await supabase.from("products").insert(payload).select("id").maybeSingle();
      if (insertError || !data) {
        setError("Unable to add this item.");
        return;
      }
      if (imageUrl) {
        await supabase.from("product_images").insert({
          product_id: data.id,
          shop_id: shopId,
          url: imageUrl,
          is_primary: true,
          source: "upload",
          sort_order: 0,
        });
      }
    }
    setEditing(null);
    router.refresh();
  }

  async function duplicate(item: CatalogRow) {
    const supabase = createBrowserSupabase();
    const { error: insertError } = await supabase.from("products").insert({
      shop_id: shopId,
      type: kind,
      name: `${item.name} copy`,
      price: item.price,
      cost: item.cost,
      stock: item.stock,
      description: item.description,
      category: item.category,
      duration: item.duration,
      image: item.image,
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
          placeholder={`Search ${kind}s...`}
          className="w-full max-w-sm rounded-xl border px-3 py-2"
        />
        <button type="button" onClick={openNew} className="rounded-full bg-[#0B6E4F] px-4 py-2 text-sm font-semibold text-white">
          + Add {kind}
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="app-table-wrap">
        <table className="app-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>{kind === "service" ? "Service" : "Product"}</th>
              <th>Price</th>
              {kind === "product" ? <th>Stock</th> : <th>Duration</th>}
              <th>Status</th>
              <th>Featured</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.image ? (
                    <MediaPreview url={item.image} title="" className="h-12 w-12 rounded-xl" interactive={false} />
                  ) : (
                    <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#F3EEE0] text-xs">—</span>
                  )}
                </td>
                <td>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-[var(--lagecto-muted)]">{item.category || "Uncategorised"}</p>
                </td>
                <td>{money(item.price)}</td>
                <td>{kind === "product" ? item.stock ?? 0 : item.duration || "—"}</td>
                <td>{item.is_available ? "Active" : "Hidden"}</td>
                <td>{item.is_popular ? "Yes" : "—"}</td>
                <td>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <button type="button" onClick={() => openEdit(item)} className="font-medium text-[#0B6E4F]">
                      Edit
                    </button>
                    <button type="button" onClick={() => void duplicate(item)} className="text-[var(--lagecto-muted)]">
                      Duplicate
                    </button>
                    <button type="button" onClick={() => void toggleAvailable(item)} className="text-[var(--lagecto-muted)]">
                      {item.is_available ? "Deactivate" : "Activate"}
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
            <h2 className="text-lg font-semibold">{editing.id ? `Edit ${kind}` : `Add ${kind}`}</h2>
            <input
              required
              value={editing.name || ""}
              onChange={(event) => setEditing({ ...editing, name: event.target.value })}
              placeholder="Name"
              className="rounded-xl border px-3 py-2"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                required
                type="number"
                min={0}
                step="0.01"
                value={editing.price ?? 0}
                onChange={(event) => setEditing({ ...editing, price: Number(event.target.value) })}
                placeholder="Price"
                className="rounded-xl border px-3 py-2"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={editing.cost ?? 0}
                onChange={(event) => setEditing({ ...editing, cost: Number(event.target.value) })}
                placeholder="Cost"
                className="rounded-xl border px-3 py-2"
              />
            </div>
            {kind === "product" ? (
              <input
                type="number"
                min={0}
                value={editing.stock ?? 0}
                onChange={(event) => setEditing({ ...editing, stock: Number(event.target.value) })}
                placeholder="Stock"
                className="rounded-xl border px-3 py-2"
              />
            ) : (
              <input
                value={editing.duration || ""}
                onChange={(event) => setEditing({ ...editing, duration: event.target.value })}
                placeholder="Duration (e.g. 45 minutes)"
                className="rounded-xl border px-3 py-2"
              />
            )}
            {categories.length ? (
              <select
                value={editing.category || ""}
                onChange={(event) => setEditing({ ...editing, category: event.target.value })}
                className="rounded-xl border px-3 py-2"
              >
                <option value="">Category</option>
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
                placeholder="Category"
                className="rounded-xl border px-3 py-2"
              />
            )}
            <textarea
              value={editing.description || ""}
              onChange={(event) => setEditing({ ...editing, description: event.target.value })}
              placeholder="Description"
              className="min-h-24 rounded-xl border px-3 py-2"
            />
            <MediaField label="Image" purpose="product" value={imageUrl} onChange={setImageUrl} hint="Upload from your device, or paste an HTTPS image URL." />
            <label className="grid gap-1 text-sm">
              Video URL (optional)
              <input
                value={videoUrl}
                onChange={(event) => setVideoUrl(event.target.value)}
                placeholder="https://example.com/video.mp4"
                className="rounded-xl border px-3 py-2"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={Boolean(editing.is_available)} onChange={(event) => setEditing({ ...editing, is_available: event.target.checked })} />
              Active / visible in storefront
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={Boolean(editing.is_popular)} onChange={(event) => setEditing({ ...editing, is_popular: event.target.checked })} />
              Featured on storefront
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded-full border px-4 py-2">
                Cancel
              </button>
              <button className="rounded-full bg-[#0B6E4F] px-4 py-2 text-white">Save</button>
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
    </div>
  );
}
