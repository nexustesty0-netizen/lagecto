"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Faq = { id: string; question: string; answer: string; sort_order?: number | null };

export function FaqManager({
  shopId,
  faqs,
}: {
  shopId: string;
  faqs: Faq[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Faq | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [pending, setPending] = useState<Faq | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function startNew() {
    setEditing(null);
    setQuestion("");
    setAnswer("");
    setError("");
  }

  function startEdit(faq: Faq) {
    setEditing(faq);
    setQuestion(faq.question);
    setAnswer(faq.answer);
    setError("");
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = question.trim();
    const a = answer.trim();
    if (!q || !a) {
      setError("Question and answer are required.");
      return;
    }
    setSaving(true);
    setError("");
    const supabase = createBrowserSupabase();
    const result = editing
      ? await supabase.from("shop_faq_entries").update({ question: q, answer: a }).eq("id", editing.id).eq("shop_id", shopId)
      : await supabase.from("shop_faq_entries").insert({
          shop_id: shopId,
          question: q,
          answer: a,
          sort_order: faqs.length,
        });
    setSaving(false);
    if (result.error) {
      setError("Unable to save this FAQ.");
      return;
    }
    startNew();
    router.refresh();
  }

  async function remove() {
    if (!pending) return;
    const supabase = createBrowserSupabase();
    const { error: deleteError } = await supabase.from("shop_faq_entries").delete().eq("id", pending.id).eq("shop_id", shopId);
    if (deleteError) {
      setError("Unable to delete this FAQ.");
      setPending(null);
      return;
    }
    if (editing?.id === pending.id) startNew();
    setPending(null);
    router.refresh();
  }

  return (
    <section className="grid gap-4">
      <form onSubmit={(event) => void save(event)} className="lg-card grid gap-3 p-5">
        <h2 className="font-semibold">{editing ? "Edit FAQ" : "Add FAQ"}</h2>
        <p className="text-sm text-[var(--lagecto-muted)]">These questions appear on your public storefront About page.</p>
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          required
          placeholder="Question"
          className="rounded-xl border px-3 py-2"
        />
        <textarea
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          required
          placeholder="Answer"
          className="min-h-24 rounded-xl border px-3 py-2"
        />
        <div className="flex flex-wrap gap-2">
          <button disabled={saving} className="rounded-xl bg-[#0B6E4F] px-4 py-2 font-semibold text-white">
            {saving ? "Saving…" : editing ? "Save changes" : "Add FAQ"}
          </button>
          {editing ? (
            <button type="button" onClick={startNew} className="rounded-xl border px-4 py-2">
              Cancel
            </button>
          ) : null}
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>

      {!faqs.length ? (
        <p className="text-sm text-[var(--lagecto-muted)]">No FAQs yet. Add the questions customers ask most often.</p>
      ) : (
        <div className="grid gap-3">
          {faqs.map((faq) => (
            <article key={faq.id} className="lg-card p-4">
              <p className="font-semibold">{faq.question}</p>
              <p className="mt-1 text-sm text-[var(--lagecto-muted)]">{faq.answer}</p>
              <div className="mt-3 flex gap-3 text-sm">
                <button type="button" className="font-medium text-[#0B6E4F]" onClick={() => startEdit(faq)}>
                  Edit
                </button>
                <button type="button" className="font-medium text-[#C2413B]" onClick={() => setPending(faq)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        title="Delete this FAQ?"
        body="It will be removed from your public storefront."
        onCancel={() => setPending(null)}
        onConfirm={() => void remove()}
      />
    </section>
  );
}
