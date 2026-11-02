"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Category = { id: string; name: string; sort_order?: number | null };

export function CategoryManager({
  shopId,
  categories,
}: {
  shopId: string;
  categories: Category[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [pending, setPending] = useState<Category | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function startNew() {
    setEditing(null);
    setName("");
    setSortOrder("");
    setError("");
  }

  function startEdit(category: Category) {
    setEditing(category);
    setName(category.name);
    setSortOrder(category.sort_order == null ? "" : String(category.sort_order));
    setError("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    nameRef.current?.focus();
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName) {
      setError("Category name is required.");
      return;
    }
    const duplicate = categories.some(
      (category) => category.id !== editing?.id && category.name.trim().toLowerCase() === nextName.toLowerCase(),
    );
    if (duplicate) {
      setError("That category already exists.");
      return;
    }
    const nextOrder = sortOrder === "" ? (editing?.sort_order ?? categories.length) : Number(sortOrder);
    if (!Number.isFinite(nextOrder)) {
      setError("Order must be a number.");
      return;
    }

    setSaving(true);
    setError("");
    const supabase = createBrowserSupabase();
    const result = editing
      ? await supabase
          .from("product_categories")
          .update({ name: nextName, sort_order: nextOrder })
          .eq("id", editing.id)
          .eq("shop_id", shopId)
      : await supabase.from("product_categories").insert({
          shop_id: shopId,
          name: nextName,
          sort_order: nextOrder,
        });

    if (result.error) {
      setSaving(false);
      setError("Unable to save this category.");
      return;
    }

    if (editing && editing.name !== nextName) {
      await supabase.from("products").update({ category: nextName }).eq("shop_id", shopId).eq("category", editing.name);
      await supabase.from("products").update({ category: nextName }).eq("shop_id", shopId).eq("category_id", editing.id);
    }

    setSaving(false);
    startNew();
    router.refresh();
  }

  async function remove() {
    if (!pending) return;
    const supabase = createBrowserSupabase();
    await supabase.from("products").update({ category: null }).eq("shop_id", shopId).eq("category", pending.name);
    const { error: deleteError } = await supabase
      .from("product_categories")
      .delete()
      .eq("id", pending.id)
      .eq("shop_id", shopId);
    if (deleteError) {
      setError("Unable to delete this category.");
      setPending(null);
      return;
    }
    if (editing?.id === pending.id) startNew();
    setPending(null);
    router.refresh();
  }

  return (
    <section className="grid gap-4">
      <form ref={formRef} onSubmit={(event) => void save(event)} className="lg-card grid gap-3 p-4 sm:p-5">
        <h2 className="font-semibold">{editing ? "Edit category" : "Add category"}</h2>
        <input
          ref={nameRef}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          placeholder="Category name"
          className="min-h-11 rounded-xl border px-3 py-2"
        />
        <input
          value={sortOrder}
          onChange={(event) => setSortOrder(event.target.value)}
          type="number"
          placeholder="Order"
          className="min-h-11 rounded-xl border px-3 py-2"
        />
        <div className="flex flex-wrap gap-2">
          <button disabled={saving} className="min-h-11 rounded-xl bg-[#0B6E4F] px-4 py-2 font-semibold text-white">
            {saving ? "Saving…" : editing ? "Save changes" : "Add category"}
          </button>
          {editing ? (
            <button type="button" onClick={startNew} className="min-h-11 rounded-xl border px-4 py-2">
              Cancel
            </button>
          ) : null}
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>

      {!categories.length ? (
        <p className="text-sm text-[var(--lagecto-muted)]">No categories yet. Group products and services here.</p>
      ) : (
        <ul className="grid gap-2">
          {categories.map((category) => (
            <li key={category.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 sm:p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{category.name}</p>
                <p className="text-xs text-[var(--lagecto-muted)]">Order {category.sort_order ?? 0}</p>
              </div>
              <button type="button" className="min-h-10 shrink-0 px-2 text-sm font-semibold text-[#0B6E4F]" onClick={() => startEdit(category)}>
                Edit
              </button>
              <button type="button" className="min-h-10 shrink-0 px-2 text-sm font-semibold text-[#C2413B]" onClick={() => setPending(category)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        title="Delete this category?"
        body="Products and services in it stay in your catalogue as uncategorised."
        onCancel={() => setPending(null)}
        onConfirm={() => void remove()}
      />
    </section>
  );
}
