import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { MediaPreview } from "@/components/media/MediaPreview";
import { ReadingProgress } from "@/components/news/ReadingProgress";
import { LinkedNewsBody } from "@/components/news/LinkedNewsBody";
import { AdStrip } from "@/components/ads/AdStrip";
import { loadPublishedArticle } from "@/lib/news/load";
import { newsShareUrl } from "@/lib/share-preview";
import { ShareLinkButton } from "@/components/share/ShareLinkButton";

export async function NewsArticle({ id, hrefBase = "/news" }: { id: string; hrefBase?: string }) {
  const article = await loadPublishedArticle(id);
  if (!article) notFound();
  const supabase = await createServerSupabase();
  const { data: related } = await supabase
    .from("lagecto_news_articles")
    .select("id, slug, title, excerpt, cover_image_url, category, published_at")
    .eq("status", "published")
    .eq("category", article.category || "platform")
    .neq("id", article.id)
    .limit(3);
  const shareUrl = newsShareUrl(article);

  return (
    <article className="news-story">
      <ReadingProgress />
      <header className="news-story-hero">
        {article.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={article.cover_image_url} alt="" className="news-story-cover" />
        ) : (
          <div className="news-story-cover-fallback" />
        )}
        <div className="relative mx-auto max-w-4xl px-4 py-10 sm:py-14">
          <Link href={hrefBase} className="mb-6 inline-block text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
            ← Journal
          </Link>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">
            {article.category || "LaGecto"} · {formatDate(article.published_at)}
            {article.author_name ? ` · ${article.author_name}` : ""}
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-5xl">{article.title}</h1>
          {article.excerpt ? (
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/82 sm:text-lg">{article.excerpt}</p>
          ) : null}
          <div className="mt-6">
            <ShareLinkButton url={shareUrl} title={article.title} body={article.excerpt} label="Share story" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        {article.video_url ? (
          <div className="mb-10 overflow-hidden rounded-[24px]">
            <MediaPreview url={article.video_url} title={article.title} playing className="w-full" />
          </div>
        ) : null}
        {article.body ? (
          <LinkedNewsBody text={article.body} className="news-story-body whitespace-pre-wrap text-[1.05rem] leading-8" />
        ) : null}

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--lagecto-border)] pt-6">
          <p className="text-sm text-[var(--lagecto-muted)]">Share this story with a preview on WhatsApp.</p>
          <ShareLinkButton url={shareUrl} title={article.title} body={article.excerpt} label="Share" />
        </div>

        <AdStrip className="mt-10" limit={2} compact />

        {related?.length ? (
          <section className="mt-14">
            <div className="news-section-head">
              <h2>Related</h2>
              <span />
            </div>
            <div className="grid gap-4">
              {related.map((row) => (
                <Link key={row.id} href={`${hrefBase}/${row.slug || row.id}`} className="news-row">
                  {row.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.cover_image_url} alt="" />
                  ) : (
                    <div className="news-row-fallback" />
                  )}
                  <div className="min-w-0 py-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0B6E4F]">
                      {row.category || "LaGecto"} · {formatDate(row.published_at)}
                    </p>
                    <p className="mt-1 font-semibold">{row.title}</p>
                    {row.excerpt ? <p className="mt-1 line-clamp-2 text-sm text-[var(--lagecto-muted)]">{row.excerpt}</p> : null}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </article>
  );
}
