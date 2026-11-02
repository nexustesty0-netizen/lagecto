import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { EmptyState } from "@/components/ui/primitives";
import { AdStrip } from "@/components/ads/AdStrip";
import { newsShareUrl } from "@/lib/share-preview";
import { ShareLinkButton } from "@/components/share/ShareLinkButton";
import { PublicHero } from "@/components/public/PublicHero";
import { MARKETPLACE_IMAGES } from "@/lib/public-catalog";

type ArticleCard = {
  id: string;
  title: string;
  excerpt: string | null;
  published_at: string | null;
  audience: string;
  category: string | null;
  cover_image_url?: string | null;
  featured?: boolean | null;
  slug?: string | null;
};

function hrefFor(base: string, article: ArticleCard) {
  return `${base}/${article.slug || article.id}`;
}

export async function NewsFeed({
  title,
  audience,
  hrefBase,
  category,
  q,
  variant = "app",
}: {
  title: string;
  audience?: string[];
  hrefBase: string;
  category?: string;
  q?: string;
  variant?: "public" | "app";
}) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("lagecto_news_articles")
    .select("id, title, excerpt, published_at, audience, category, cover_image_url, featured, slug")
    .eq("status", "published")
    .order("featured", { ascending: false })
    .order("published_at", { ascending: false });
  const query = String(q || "").trim().toLowerCase();
  const articles = ((data || []) as ArticleCard[]).filter((row) => {
    if (audience?.length && row.audience !== "all" && !audience.includes(row.audience)) return false;
    if (category && category !== "all" && row.category !== category) return false;
    if (query && !`${row.title} ${row.excerpt || ""}`.toLowerCase().includes(query)) return false;
    return true;
  });
  const categories = [...new Set((data || []).map((row) => row.category).filter(Boolean))] as string[];
  const featured = articles.find((row) => row.featured) || articles[0];
  const rest = articles.filter((row) => row.id !== featured?.id);
  const lead = rest.slice(0, 2);
  const latest = rest.slice(2, 6);
  const more = rest.slice(6);
  const isPublic = variant === "public";

  return (
    <div className={isPublic ? "news-edition" : "news-edition news-edition-app"}>
      {isPublic ? (
        <PublicHero
          kicker="The journal"
          title={title}
          subtitle="Stories from LaGecto shops, the marketplace, and the people building local commerce."
          image={MARKETPLACE_IMAGES.shopsHero}
        />
      ) : (
        <header className="mb-8">
          <p className="os-kicker">The journal</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--lagecto-muted)]">
            Stories from LaGecto shops and the marketplace.
          </p>
        </header>
      )}

      <div className={isPublic ? "mx-auto max-w-6xl px-4 py-8 sm:py-12" : ""}>
        <form className="news-toolbar" action={hrefBase} method="get">
          {category && category !== "all" ? <input type="hidden" name="category" value={category} /> : null}
          <input name="q" defaultValue={q || ""} placeholder="Search stories" className="news-search" />
          <div className="news-topics">
            <Link href={hrefBase} className={`news-chip ${!category || category === "all" ? "is-active" : ""}`}>
              All
            </Link>
            {categories.map((item) => (
              <Link
                key={item}
                href={`${hrefBase}?category=${encodeURIComponent(item)}`}
                className={`news-chip ${category === item ? "is-active" : ""}`}
              >
                {item}
              </Link>
            ))}
          </div>
          <button className="news-search-btn">Search</button>
        </form>

        {!articles.length ? (
          <div className="mt-10">
            <EmptyState title="No news yet" body="Published LaGecto News will appear here." />
          </div>
        ) : (
          <div className="mt-8 grid gap-12">
            {featured ? (
              <article className="news-feature">
                <Link href={hrefFor(hrefBase, featured)} className="group grid overflow-hidden lg:grid-cols-2">
                  {featured.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={featured.cover_image_url} alt="" className="news-feature-image" />
                  ) : (
                    <div className="news-feature-fallback" />
                  )}
                  <div className="news-feature-copy">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">
                      {featured.featured ? "Cover story" : "Latest"} · {featured.category || "LaGecto"}
                    </p>
                    <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">{featured.title}</h2>
                    {featured.excerpt ? (
                      <p className="mt-3 max-w-2xl text-sm leading-7 text-white/80 sm:text-base">{featured.excerpt}</p>
                    ) : null}
                    <p className="mt-4 text-xs uppercase tracking-[0.16em] text-white/70">{formatDate(featured.published_at)}</p>
                  </div>
                </Link>
                <div className="news-feature-share">
                  <ShareLinkButton url={newsShareUrl(featured)} title={featured.title} body={featured.excerpt} compact />
                </div>
              </article>
            ) : null}

            <AdStrip limit={2} compact />

            {lead.length ? (
              <section>
                <div className="news-section-head">
                  <h3>In this edition</h3>
                  <span />
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                  {lead.map((article) => (
                    <Link key={article.id} href={hrefFor(hrefBase, article)} className="news-lead">
                      {article.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={article.cover_image_url} alt="" />
                      ) : (
                        <div className="news-lead-fallback" />
                      )}
                      <div className="p-5 sm:p-6">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0B6E4F]">
                          {article.category || "LaGecto"} · {formatDate(article.published_at)}
                        </p>
                        <h3 className="mt-2 text-2xl font-semibold tracking-tight">{article.title}</h3>
                        {article.excerpt ? <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--lagecto-muted)]">{article.excerpt}</p> : null}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            {latest.length ? (
              <section>
                <div className="news-section-head">
                  <h3>Latest</h3>
                  <span />
                </div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {latest.map((article) => (
                    <Link key={article.id} href={hrefFor(hrefBase, article)} className="news-card">
                      {article.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={article.cover_image_url} alt="" />
                      ) : (
                        <div className="news-card-fallback" />
                      )}
                      <div className="p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0B6E4F]">
                          {article.category || "LaGecto"}
                        </p>
                        <h3 className="mt-1 text-lg font-semibold leading-snug">{article.title}</h3>
                        <p className="mt-2 text-xs text-[var(--lagecto-muted)]">{formatDate(article.published_at)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            {more.length ? (
              <section>
                <div className="news-section-head">
                  <h3>More stories</h3>
                  <span />
                </div>
                <div className="grid gap-3">
                  {more.map((article) => (
                    <Link key={article.id} href={hrefFor(hrefBase, article)} className="news-row">
                      {article.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={article.cover_image_url} alt="" />
                      ) : (
                        <div className="news-row-fallback" />
                      )}
                      <div className="min-w-0 py-1">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0B6E4F]">
                          {article.category || "LaGecto"} · {formatDate(article.published_at)}
                        </p>
                        <h3 className="mt-1 font-semibold">{article.title}</h3>
                        {article.excerpt ? <p className="mt-1 line-clamp-2 text-sm text-[var(--lagecto-muted)]">{article.excerpt}</p> : null}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
