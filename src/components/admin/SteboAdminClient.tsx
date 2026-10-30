"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { InsertForm } from "@/components/forms/InsertForm";

export function SteboAdminClient({
  knowledge,
  examples,
  industries,
  personality,
}: {
  knowledge: { id: string; section: string; title: string; body: string; is_active: boolean }[];
  examples: { id: string; prompt: string; response: string }[];
  industries: { id: string; name: string; notes: string | null }[];
  personality: { display_name: string | null; traits: Record<string, unknown> | null } | null;
}) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function savePersonality(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const supabase = createBrowserSupabase();
    const { error: saveError } = await supabase
      .from("stebo_personality_settings")
      .update({
        display_name: String(form.get("display_name") || "Stebo"),
        traits: { tone: String(form.get("tone") || "warm") },
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (saveError) setError("Unable to save personality.");
    else router.refresh();
  }

  return (
    <div className="grid gap-8">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <section>
        <h2 className="mb-3 font-semibold">Personality</h2>
        <form onSubmit={savePersonality} className="grid gap-3 rounded-2xl bg-white p-4 md:grid-cols-3">
          <input name="display_name" defaultValue={personality?.display_name || "Stebo"} className="rounded-xl border px-3 py-2" />
          <input name="tone" defaultValue={String(personality?.traits?.tone || "warm")} placeholder="Tone" className="rounded-xl border px-3 py-2" />
          <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Save</button>
        </form>
      </section>
      <section>
        <h2 className="mb-3 font-semibold">Knowledge</h2>
        <InsertForm
          table="stebo_knowledge"
          submitLabel="Add knowledge"
          fields={[
            { name: "section", placeholder: "section (base, rules, lagecto)", required: true },
            { name: "title", placeholder: "Title", required: true },
            { name: "body", type: "textarea", placeholder: "Body", required: true, className: "md:col-span-4" },
          ]}
        />
        <div className="mt-4 grid gap-3">
          {knowledge.map((row) => (
            <article key={row.id} className="rounded-2xl bg-white p-4">
              <p className="text-xs uppercase text-[#6B7280]">{row.section}</p>
              <p className="font-semibold">{row.title}</p>
              <p className="text-sm text-[#6B7280]">{row.body}</p>
            </article>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-3 font-semibold">Training examples</h2>
        <InsertForm
          table="stebo_training_examples"
          submitLabel="Add example"
          fields={[
            { name: "prompt", placeholder: "User prompt", required: true, className: "md:col-span-2" },
            { name: "response", type: "textarea", placeholder: "Ideal response", required: true },
          ]}
        />
        <div className="mt-4 grid gap-3">
          {examples.map((row) => (
            <article key={row.id} className="rounded-2xl bg-white p-4">
              <p className="font-medium">{row.prompt}</p>
              <p className="text-sm text-[#6B7280]">{row.response}</p>
            </article>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-3 font-semibold">Industry knowledge</h2>
        <InsertForm
          table="stebo_industries"
          submitLabel="Add industry"
          fields={[
            { name: "name", placeholder: "Industry", required: true },
            { name: "notes", type: "textarea", placeholder: "Notes" },
          ]}
        />
        <div className="mt-4 grid gap-3">
          {industries.map((row) => (
            <article key={row.id} className="rounded-2xl bg-white p-4">
              <p className="font-semibold">{row.name}</p>
              <p className="text-sm text-[#6B7280]">{row.notes}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
