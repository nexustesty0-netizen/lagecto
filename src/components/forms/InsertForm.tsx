"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export type FormField = {
  name: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  className?: string;
};

export function InsertForm({
  table,
  fields,
  extra,
  submitLabel = "Add",
  className = "grid gap-3 rounded-2xl bg-white p-4 md:grid-cols-4",
}: {
  table: string;
  fields: FormField[];
  extra?: Record<string, unknown>;
  submitLabel?: string;
  className?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const row: Record<string, unknown> = { ...(extra || {}) };
    for (const field of fields) {
      const raw = form.get(field.name);
      if (field.type === "number") row[field.name] = Number(raw || 0);
      else if (field.type === "checkbox") row[field.name] = form.get(field.name) === "on";
      else row[field.name] = String(raw || "");
    }
    const supabase = createBrowserSupabase();
    const { error: insertError } = await supabase.from(table).insert(row);
    if (insertError) setError("Unable to save. Check the details and try again.");
    else {
      formEl.reset();
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className={className}>
      {fields.map((field) =>
        field.options ? (
          <select key={field.name} name={field.name} required={field.required} className={`rounded-xl border px-3 py-2 ${field.className || ""}`}>
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : field.type === "textarea" ? (
          <textarea
            key={field.name}
            name={field.name}
            required={field.required}
            placeholder={field.placeholder}
            className={`min-h-24 rounded-xl border px-3 py-2 ${field.className || "md:col-span-4"}`}
          />
        ) : (
          <input
            key={field.name}
            name={field.name}
            type={field.type || "text"}
            required={field.required}
            placeholder={field.placeholder}
            step={field.type === "number" ? "0.01" : undefined}
            className={`rounded-xl border px-3 py-2 ${field.className || ""}`}
          />
        ),
      )}
      <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">{submitLabel}</button>
      {error ? <p className="text-sm text-red-600 md:col-span-4">{error}</p> : null}
    </form>
  );
}
