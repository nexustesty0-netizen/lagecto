import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { parseMediaEmbed } from "@/lib/media";
import { ReadingProgress } from "@/components/news/ReadingProgress";
import { LinkedNewsBody } from "@/components/news/LinkedNewsBody";

export async function NewsArticle({ id, hrefBase = "/news" }: { id: string; hrefBase?: string }) {
  const supabase = await createServerSupabase();
  const uuid = /^[0-9a-f-]{36}$/i.test(id);
  let query = supabase.from("lagecto_news_articles").select("*").eq("status", "published");
  query = uuid ? query.eq("id", id) : query.eq("slug", id);
  const { data: article } = await query.maybeSingle();
  if (!article) notFound();
  const { data: related } = await supabase
    .from("lagecto_news_articles")
    .select("id, slug, title, excerpt, cover_image_url")
    .eq("status", "published")
    .eq("category", article.category || "platform")
    .neq("id", article.id)
    .limit(3);
  const video = article.video_url ? parseMediaEmbed(article.video_url) : null;

  return (
    <article className="mx-auto max-w-3xl">
      <ReadingProgress />
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D4AF37]">
        {article.category || "LaGecto"} · {formatDate(article.published_at)}
        {article.author_name ? ` · ${article.author_name}` : ""}
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">{article.title}</h1>
      {article.excerpt ? <LinkedNewsBody text={article.excerpt} className="mt-3 text-lg leading-8 text-[#6B7280]" /> : null}
      {article.cover_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={article.cover_image_url} alt="" className="mt-6 h-80 w-full rounded-[28px] object-cover" />
      ) : null}
      {video?.embed ? (
        <div className="mt-6 overflow-hidden rounded-[24px]">
          <iframe src={video.embed} title="Video" className="aspect-video w-full" allow="encrypted-media; picture-in-picture" allowFullScreen />
        </div>
      ) : null}
      <LinkedNewsBody text={article.body} className="mt-8 whitespace-pre-wrap text-lg leading-8" />
      {related?.length ? (
        <section className="mt-12">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">Related</h2>
          <div className="mt-3 grid gap-3">
            {related.map((row) => (
              <Link key={row.id} href={`${hrefBase}/${row.slug || row.id}`} className="rounded-2xl bg-white p-4">
                <p className="font-semibold">{row.title}</p>
                <p className="text-sm text-[#6B7280]">{row.excerpt}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
