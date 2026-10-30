"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function StorefrontForm({
  shopId,
  config,
  faqs,
}: {
  shopId: string;
  config: { hero_title: string | null; hero_subtitle: string | null } | null;
  faqs: { id: string; question: string; answer: string }[];
}) {
  const router = useRouter();
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const supabase = createBrowserSupabase();
    await supabase.from("shop_storefront_config").upsert({
      shop_id: shopId,
      hero_title: String(form.get("hero_title") || ""),
      hero_subtitle: String(form.get("hero_subtitle") || ""),
      updated_at: new Date().toISOString(),
    });
    router.refresh();
  }
  async function addFaq(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const supabase = createBrowserSupabase();
    await supabase.from("shop_faq_entries").insert({
      shop_id: shopId,
      question: String(form.get("question") || ""),
      answer: String(form.get("answer") || ""),
    });
    event.currentTarget.reset();
    router.refresh();
  }
  return (
    <div className="grid gap-6">
      <form onSubmit={save} className="grid gap-3 rounded-2xl bg-white p-4">
        <input name="hero_title" defaultValue={config?.hero_title || ""} placeholder="Hero title" className="rounded-xl border px-3 py-2" />
        <textarea name="hero_subtitle" defaultValue={config?.hero_subtitle || ""} placeholder="Hero subtitle" className="min-h-20 rounded-xl border px-3 py-2" />
        <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Save storefront</button>
      </form>
      <form onSubmit={addFaq} className="grid gap-3 rounded-2xl bg-white p-4">
        <input name="question" required placeholder="FAQ question" className="rounded-xl border px-3 py-2" />
        <textarea name="answer" required placeholder="Answer" className="min-h-20 rounded-xl border px-3 py-2" />
        <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Add FAQ</button>
      </form>
      <div className="grid gap-3">
        {faqs.map((faq) => (
          <article key={faq.id} className="rounded-2xl bg-white p-4">
            <p className="font-semibold">{faq.question}</p>
            <p className="text-sm text-[#6B7280]">{faq.answer}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
