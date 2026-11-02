"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export type Supplier = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  details?: string | null;
  supplies?: string | null;
};

function blank() {
  return { name: "", phone: "", email: "", address: "", details: "", supplies: "" };
}

export function SupplierManager({
  shopId,
  suppliers,
}: {
  shopId: string;
  suppliers: Supplier[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(blank());
  const [pending, setPending] = useState<Supplier | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function startNew() {
    setEditing(null);
    setForm(blank());
    setError("");
  }

  function startEdit(supplier: Supplier) {
    setEditing(supplier);
    setForm({
      name: supplier.name || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      details: supplier.details || "",
      supplies: supplier.supplies || "",
    });
    setError("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    nameRef.current?.focus();
  }

  function setField(key: keyof ReturnType<typeof blank>, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setError("Supplier name is required.");
      return;
    }

    setSaving(true);
    setError("");
    const payload = {
      shop_id: shopId,
      name,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      details: form.details.trim() || null,
      supplies: form.supplies.trim() || null,
    };
    const supabase = createBrowserSupabase();
    const result = editing
      ? await supabase.from("suppliers").update(payload).eq("id", editing.id).eq("shop_id", shopId)
      : await supabase.from("suppliers").insert(payload);

    setSaving(false);
    if (result.error) {
      const message = result.error.message.toLowerCase();
      setError(
        message.includes("column") || message.includes("schema cache")
          ? "Run the supplier details SQL in Supabase, then try again."
          : "Unable to save this supplier.",
      );
      return;
    }
    startNew();
    router.refresh();
  }

  async function remove() {
    if (!pending) return;
    const supabase = createBrowserSupabase();
    const { error: deleteError } = await supabase.from("suppliers").delete().eq("id", pending.id).eq("shop_id", shopId);
    if (deleteError) {
      setError("Unable to delete this supplier.");
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
        <h2 className="font-semibold">{editing ? "Edit supplier" : "Add supplier"}</h2>
        <label className="grid gap-1 text-sm">
          Name
          <input
            ref={nameRef}
            value={form.name}
            onChange={(event) => setField("name", event.target.value)}
            required
            placeholder="Supplier name"
            className="min-h-11 rounded-xl border px-3 py-2"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Phone
            <input
              value={form.phone}
              onChange={(event) => setField("phone", event.target.value)}
              placeholder="Phone"
              className="min-h-11 rounded-xl border px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Email
            <input
              value={form.email}
              onChange={(event) => setField("email", event.target.value)}
              type="email"
              placeholder="Email"
              className="min-h-11 rounded-xl border px-3 py-2"
            />
          </label>
        </div>
        <label className="grid gap-1 text-sm">
          Address
          <input
            value={form.address}
            onChange={(event) => setField("address", event.target.value)}
            placeholder="Address"
            className="min-h-11 rounded-xl border px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          What they supply
          <textarea
            value={form.supplies}
            onChange={(event) => setField("supplies", event.target.value)}
            placeholder="e.g. flour, cooking oil, drinks"
            className="min-h-24 rounded-xl border px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Details
          <textarea
            value={form.details}
            onChange={(event) => setField("details", event.target.value)}
            placeholder="Contact person, delivery days, payment terms"
            className="min-h-24 rounded-xl border px-3 py-2"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button disabled={saving} className="min-h-11 rounded-xl bg-[#0B6E4F] px-4 py-2 font-semibold text-white">
            {saving ? "Saving…" : editing ? "Save changes" : "Add supplier"}
          </button>
          {editing ? (
            <button type="button" onClick={startNew} className="min-h-11 rounded-xl border px-4 py-2">
              Cancel
            </button>
          ) : null}
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>

      {!suppliers.length ? (
        <p className="text-sm text-[var(--lagecto-muted)]">No suppliers yet. Add who you buy from and what they supply.</p>
      ) : (
        <ul className="grid gap-2">
          {suppliers.map((supplier) => (
            <li key={supplier.id} className="rounded-2xl bg-white p-3 sm:p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{supplier.name}</p>
                  {supplier.supplies ? <p className="mt-1 text-sm text-[#0B6E4F]">{supplier.supplies}</p> : null}
                  <p className="mt-1 text-sm text-[var(--lagecto-muted)]">
                    {[supplier.phone, supplier.email].filter(Boolean).join(" · ") || "No contact yet"}
                  </p>
                  {supplier.address ? <p className="mt-1 text-sm text-[var(--lagecto-muted)]">{supplier.address}</p> : null}
                  {supplier.details ? <p className="mt-2 whitespace-pre-wrap text-sm">{supplier.details}</p> : null}
                </div>
                <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:gap-2">
                  <button type="button" className="min-h-10 px-2 text-sm font-semibold text-[#0B6E4F]" onClick={() => startEdit(supplier)}>
                    Edit
                  </button>
                  <button type="button" className="min-h-10 px-2 text-sm font-semibold text-[#C2413B]" onClick={() => setPending(supplier)}>
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        title="Delete this supplier?"
        body="Past purchases stay on the books. The supplier name is removed from this list."
        onCancel={() => setPending(null)}
        onConfirm={() => void remove()}
      />
    </section>
  );
}
