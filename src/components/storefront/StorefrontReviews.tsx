import { formatDate } from "@/lib/format";

export type StorefrontReview = {
  id: string;
  rating: number;
  review: string | null;
  reply?: string | null;
  reviewer_name?: string | null;
  created_at: string;
};

export function StorefrontReviews({
  reviews,
  heading = "Reviews",
  embedded = false,
}: {
  reviews: StorefrontReview[];
  heading?: string;
  embedded?: boolean;
}) {
  if (!reviews.length) return null;
  return (
    <section className={embedded ? "grid gap-3" : "sf-reveal mx-auto max-w-6xl px-4 pb-16"}>
      {embedded ? (
        <h2 className="text-xl font-semibold">{heading}</h2>
      ) : (
        <div className="mb-6">
          <p className="sf-kicker">Guests</p>
          <h2 className="mt-2 text-3xl font-semibold">{heading}</h2>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {reviews.map((review) => (
          <article key={review.id} className="sf-card p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">{review.reviewer_name || "Guest"}</p>
              <p className="text-sm font-semibold">{review.rating}/5</p>
            </div>
            {review.review ? (
              <p className="mt-2 text-sm leading-6" style={{ color: "var(--sf-muted)" }}>
                {review.review}
              </p>
            ) : null}
            {review.reply ? (
              <p className="mt-3 rounded-xl bg-black/5 px-3 py-2 text-sm">
                Shop reply: {review.reply}
              </p>
            ) : null}
            <p className="mt-2 text-xs" style={{ color: "var(--sf-muted)" }}>
              {formatDate(review.created_at)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
