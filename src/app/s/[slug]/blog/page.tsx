import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getStorefrontBySlug } from "@/lib/storefront/load";
import { storefrontPath } from "@/lib/storefront/paths";
import { formatDate } from "@/lib/format";
import { MediaPreview } from "@/components/media/MediaPreview";
import { blogMediaUrl } from "@/lib/storefront/load";

export default async function StorefrontBlogPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getStorefrontBySlug(slug);
  if (!data) notFound();
  const supabase = await createServerSupabase();
  const { data: posts } = await supabase
    .from("storefront_blog_posts")
    .select("*")
    .eq("shop_id", data.shop.id)
    .eq("status", "published")
    .order("published_at", { ascending: false });
  const base = storefrontPath(data.shop.slug);
  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Blog</h1>
      {!posts?.length ? (
        <p className="mt-6 text-sm" style={{ color: "var(--sf-muted)" }}>
          No published articles yet.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {posts.map((post) => (
            <article key={post.id} className="sf-card overflow-hidden">
              {blogMediaUrl(post) ? <MediaPreview url={blogMediaUrl(post) || ""} title={post.title} className="h-48 w-full" /> : null}
              <Link href={`${base}/blog/${post.id}`} className="block p-5">
                <h2 className="text-xl font-semibold">{post.title}</h2>
                <p className="mt-2 text-sm" style={{ color: "var(--sf-muted)" }}>
                  {post.excerpt || formatDate(post.published_at)}
                </p>
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
