"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { formatDate } from "@/lib/format";

export type ShopReviewRow = {
  id: string;
  rating: number;
  review: string | null;
  reply: string | null;
  reviewer_name?: string | null;
  is_hidden: boolean;
  created_at: string;
};

export function ReviewsManager({ reviews }: { reviews: ShopReviewRow[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function moderate(id: string, action: "hide" | "show" | "delete") {
    setBusy(id);
    setMessage("");
    const supabase = createBrowserSupabase();
    const { data, error } = await supabase.rpc("moderate_shop_review", { p_review_id: id, p_action: action });
    setBusy(null);
    if (error || data?.ok === false) {
      setMessage(data?.error || "Unable to update this review.");
      return;
    }
    setMessage(action === "delete" ? "Review deleted." : action === "hide" ? "Review hidden from the storefront." : "Review is visible on the storefront.");
    router.refresh();
  }

  if (!reviews.length) {
    return <p className="lg-card p-5 text-sm text-[var(--lagecto-muted)]">No reviews yet. Customer and guest reviews will appear here.</p>;
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-[var(--lagecto-muted)]">Hide a review to take it off the public storefront, or delete it permanently.</p>
      {reviews.map((review) => (
        <article key={review.id} className="lg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{review.reviewer_name || "Guest"} · {review.rating}/5</p>
              <p className="text-xs text-[var(--lagecto-muted)]">{formatDate(review.created_at)}</p>
            </div>
            {review.is_hidden ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">Hidden</span> : null}
          </div>
          {review.review ? <p className="mt-3 text-sm leading-6">{review.review}</p> : null}
          {review.reply ? <p className="mt-2 text-sm text-[var(--lagecto-muted)]">Reply: {review.reply}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {review.is_hidden ? (
              <button type="button" disabled={busy === review.id} onClick={() => void moderate(review.id, "show")} className="rounded-xl border px-3 py-2 text-sm">
                Show
              </button>
            ) : (
              <button type="button" disabled={busy === review.id} onClick={() => void moderate(review.id, "hide")} className="rounded-xl border px-3 py-2 text-sm">
                Hide
              </button>
            )}
            <button type="button" disabled={busy === review.id} onClick={() => void moderate(review.id, "delete")} className="rounded-xl border border-red-200 px-3 py-2 text-sm text-[#C2413B]">
              Delete
            </button>
          </div>
        </article>
      ))}
      {message ? <p className="text-sm text-[#0B6E4F]">{message}</p> : null}
    </div>
  );
}
