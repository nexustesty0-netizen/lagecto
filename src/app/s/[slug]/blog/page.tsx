import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getStorefrontBySlug } from "@/lib/storefront/load";
import { storefrontPath } from "@/lib/storefront/paths";
import { formatDate } from "@/lib/format";
import { MediaPreview } from "@/components/media/MediaPreview";
import { blogMediaUrl } from "@/lib/storefront/load";
import { mediaFrameClass } from "@/lib/media";
import { TechHero } from "@/components/storefront/tech/TechHero";
import { StorefrontVideo } from "@/components/storefront/StorefrontVideo";
import { techHeroImage, techHeroPosition, techPageTitle } from "@/lib/storefront/template";
import { storefrontOgDescription } from "@/lib/storefront/og";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getStorefrontBySlug(slug);
  if (!data) return { title: "Blog / Vlog" };
  return {
    title: techPageTitle(data.shop, "blog"),
    description: storefrontOgDescription({
      name: data.shop.name,
      meta_description: data.shop.meta_description,
      tagline: data.config?.tagline,
      about: data.shop.about,
    }),
  };
}

export default async function StorefrontBlogPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getStorefrontBySlug(slug);
  if (!data) notFound();
  const supabase = await createServerSupabase();
  const [{ data: posts }, { data: videos }] = await Promise.all([
    supabase
      .from("storefront_blog_posts")
      .select("*")
      .eq("shop_id", data.shop.id)
      .eq("status", "published")
      .order("published_at", { ascending: false }),
    supabase
      .from("storefront_videos")
      .select("id, title, url")
      .eq("shop_id", data.shop.id)
      .eq("is_published", true)
      .order("sort_order"),
  ]);
  const base = storefrontPath(data.shop.slug);
  const [featured, ...rest] = posts || [];
  const vlogs = videos || [];
  const empty = !featured && !vlogs.length;

  return (
    <>
      <TechHero
        image={techHeroImage("blog", data.shop, data.config)}
        kicker="Blog / Vlog"
        title="Blog / Vlog"
        subtitle={`Stories and videos from ${data.shop.name}.`}
        objectPosition={techHeroPosition("blog", data.config)}
      />
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-2">
        {empty ? (
          <div className="sf-panel p-10 text-center">
            <p className="text-lg font-semibold">No posts or vlogs yet</p>
            <p className="mt-2 text-sm" style={{ color: "var(--sf-muted)" }}>
              When {data.shop.name} publishes a story or video, it will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-10">
            {vlogs.length ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--sf-primary)]">Vlog</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight">Videos</h2>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {vlogs.map((video) => (
                    <StorefrontVideo key={video.id} title={video.title} url={video.url} />
                  ))}
                </div>
              </div>
            ) : null}
            {featured ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--sf-primary)]">Blog</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight">Stories</h2>
                <article className="sf-panel mt-5 overflow-hidden md:grid md:grid-cols-2">
                  {blogMediaUrl(featured) ? (
                    <MediaPreview url={blogMediaUrl(featured) || ""} title={featured.title} playing className={mediaFrameClass(blogMediaUrl(featured) || "")} />
                  ) : (
                    <div className="min-h-[240px]" style={{ background: "color-mix(in srgb, var(--sf-primary) 10%, white)" }} />
                  )}
                  <Link href={`${base}/blog/${featured.id}`} className="flex flex-col justify-center p-6 sm:p-8">
                    <p className="text-xs uppercase tracking-[0.14em]" style={{ color: "var(--sf-muted)" }}>
                      {formatDate(featured.published_at)}
                    </p>
                    <h3 className="mt-2 text-3xl font-semibold">{featured.title}</h3>
                    <p className="mt-3 text-sm leading-7" style={{ color: "var(--sf-muted)" }}>
                      {featured.excerpt || "Open the story"}
                    </p>
                    <span className="mt-5 text-sm font-semibold text-[var(--sf-primary)]">Read post</span>
                  </Link>
                </article>
                {rest.length ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {rest.map((post) => (
                      <article key={post.id} className="sf-panel overflow-hidden">
                        {blogMediaUrl(post) ? (
                          <MediaPreview url={blogMediaUrl(post) || ""} title={post.title} playing className={mediaFrameClass(blogMediaUrl(post) || "")} />
                        ) : null}
                        <Link href={`${base}/blog/${post.id}`} className="block p-5">
                          <p className="text-xs uppercase tracking-[0.14em]" style={{ color: "var(--sf-muted)" }}>
                            {formatDate(post.published_at)}
                          </p>
                          <h3 className="mt-2 text-xl font-semibold">{post.title}</h3>
                          <p className="mt-2 line-clamp-3 text-sm leading-6" style={{ color: "var(--sf-muted)" }}>
                            {post.excerpt || "Read the story"}
                          </p>
                        </Link>
                      </article>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </section>
    </>
  );
}
