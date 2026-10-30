"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReviewForm({ shopId, defaultName = "" }: { shopId: string; defaultName?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const { createBrowserSupabase } = await import("@/lib/supabase/browser");
    const supabase = createBrowserSupabase();
    const { data, error } = await supabase.rpc("leave_shop_review", {
      p_shop_id: shopId,
      p_rating: Number(form.get("rating")),
      p_review: String(form.get("review") || ""),
      p_reviewer_name: String(form.get("reviewer_name") || "").trim(),
    });
    if (error || data?.ok === false) {
      setMessage(data?.error || error?.message || "Unable to save this review.");
      return;
    }
    setMessage("Review saved. It will appear on this shop’s storefront.");
    event.currentTarget.reset();
    router.refresh();
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl bg-white p-4 sm:grid-cols-2">
      <input
        name="reviewer_name"
        defaultValue={defaultName}
        required
        minLength={2}
        className="rounded-xl border px-3 py-2"
        placeholder="Your name or business name"
      />
      <select name="rating" className="rounded-xl border px-3 py-2" defaultValue="5">
        {[5, 4, 3, 2, 1].map((n) => (
          <option key={n} value={n}>
            {n} stars
          </option>
        ))}
      </select>
      <textarea name="review" className="min-h-20 rounded-xl border px-3 py-2 sm:col-span-2" placeholder="Write a review" />
      <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white sm:col-span-2">Submit review</button>
      {message ? <p className="sm:col-span-2 text-sm text-[#6B7280]">{message}</p> : null}
    </form>
  );
}
