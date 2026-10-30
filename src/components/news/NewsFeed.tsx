import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { PageHeader, EmptyState } from "@/components/ui/primitives";

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

export async function NewsFeed({
  title,
  audience,
  hrefBase,
  category,
  q,
}: {
  title: string;
  audience?: string[];
  hrefBase: string;
  category?: string;
  q?: string;
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
  const latest = rest.slice(0, 4);
  const more = rest.slice(4);
  const hrefFor = (article: ArticleCard) => `${hrefBase}/${article.slug || article.id}`;

  return (
    <>
      <PageHeader title={title} subtitle="Stories from the LaGecto newsroom." />
      <form className="mb-6 flex flex-wrap gap-2" action={hrefBase} method="get">
        <input name="q" defaultValue={q || ""} placeholder="Search stories" className="min-w-0 flex-1 rounded-full border px-4 py-2" />
        <select name="category" defaultValue={category || "all"} className="rounded-full border px-4 py-2">
          <option value="all">All topics</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button className="rounded-full bg-[#0B6E4F] px-4 py-2 text-sm font-semibold text-white">Search</button>
      </form>
      {!articles.length ? (
        <EmptyState title="No news yet" body="Published LaGecto News will appear here." />
      ) : (
        <div className="grid gap-6">
          {featured ? (
            <Link href={hrefFor(featured)} className="group relative overflow-hidden rounded-[32px] bg-[#12241c] text-white">
              {featured.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={featured.cover_image_url} alt="" className="h-72 w-full object-cover opacity-70 transition group-hover:scale-[1.02] sm:h-96" />
              ) : (
                <div className="h-72 bg-gradient-to-br from-[#0B6E4F] to-[#12241c] sm:h-96" />
              )}
              <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">Featured</p>
                <h2 className="mt-2 max-w-3xl text-3xl font-semibold sm:text-5xl">{featured.title}</h2>
                {featured.excerpt ? <p className="mt-3 max-w-2xl text-sm text-white/80">{featured.excerpt}</p> : null}
              </div>
            </Link>
          ) : null}
          {latest.length ? (
            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">Latest</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {latest.map((article) => (
                  <Link key={article.id} href={hrefFor(article)} className="overflow-hidden rounded-[24px] bg-white">
                    {article.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={article.cover_image_url} alt="" className="h-44 w-full object-cover" />
                    ) : null}
                    <div className="p-4">
                      <p className="text-xs uppercase tracking-wide text-[#0B6E4F]">{article.category || "LaGecto"}</p>
                      <p className="mt-1 font-semibold">{article.title}</p>
                      <p className="mt-1 text-sm text-[#6B7280]">{article.excerpt}</p>
                      <p className="mt-2 text-xs text-[#6B7280]">{formatDate(article.published_at)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
          {more.length ? (
            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">More stories</h3>
              <div className="grid gap-3">
                {more.map((article) => (
                  <Link key={article.id} href={hrefFor(article)} className="flex gap-4 rounded-2xl bg-white p-3">
                    {article.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={article.cover_image_url} alt="" className="h-20 w-28 rounded-xl object-cover" />
                    ) : null}
                    <div>
                      <p className="font-semibold">{article.title}</p>
                      <p className="text-sm text-[#6B7280]">{article.excerpt}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
