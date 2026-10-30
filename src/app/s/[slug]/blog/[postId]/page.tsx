import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getStorefrontBySlug } from "@/lib/storefront/load";
import { formatDate } from "@/lib/format";
import { MediaPreview } from "@/components/media/MediaPreview";
import { blogMediaUrl } from "@/lib/storefront/load";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; postId: string }> }): Promise<Metadata> {
  const { slug, postId } = await params;
  const data = await getStorefrontBySlug(slug);
  if (!data) return { title: "Article" };
  const supabase = await createServerSupabase();
  const { data: post } = await supabase
    .from("storefront_blog_posts")
    .select("title, excerpt, cover_image")
    .eq("id", postId)
    .eq("shop_id", data.shop.id)
    .eq("status", "published")
    .maybeSingle();
  return {
    title: post?.title || "Article",
    description: post?.excerpt || undefined,
    openGraph: { images: post?.cover_image ? [{ url: post.cover_image }] : undefined },
  };
}

export default async function StorefrontPostPage({ params }: { params: Promise<{ slug: string; postId: string }> }) {
  const { slug, postId } = await params;
  const data = await getStorefrontBySlug(slug);
  if (!data) notFound();
  const supabase = await createServerSupabase();
  const { data: post } = await supabase
    .from("storefront_blog_posts")
    .select("*")
    .eq("id", postId)
    .eq("shop_id", data.shop.id)
    .eq("status", "published")
    .maybeSingle();
  if (!post) notFound();
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-sm" style={{ color: "var(--sf-muted)" }}>
        {formatDate(post.published_at)}
      </p>
      <h1 className="mt-2 text-4xl font-semibold">{post.title}</h1>
      {blogMediaUrl(post) ? <MediaPreview url={blogMediaUrl(post) || ""} title={post.title} className="mt-6 w-full rounded-[28px]" /> : null}
      <div className="mt-6 whitespace-pre-wrap leading-8">{post.body}</div>
    </article>
  );
}
