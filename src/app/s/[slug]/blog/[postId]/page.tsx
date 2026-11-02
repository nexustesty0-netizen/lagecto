import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getStorefrontBySlug } from "@/lib/storefront/load";
import { storefrontPath } from "@/lib/storefront/paths";
import { storefrontShareUrl } from "@/lib/storefront/socials";
import { ogImages } from "@/lib/share-preview";
import { BRAND } from "@/lib/brand";
import { formatDate } from "@/lib/format";
import { MediaPreview } from "@/components/media/MediaPreview";
import { blogMediaUrl } from "@/lib/storefront/load";
import { mediaFrameClass } from "@/lib/media";

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
  const title = post?.title || "Article";
  const description = post?.excerpt || `${title} from ${data.shop.name}`;
  const url = `${storefrontShareUrl(undefined, slug)}/blog/${postId}`;
  const images = ogImages(post?.cover_image || data.shop.banner_url, title);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      siteName: BRAND.name,
      title,
      description,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images?.map((item) => item.url),
    },
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
  const base = storefrontPath(data.shop.slug);
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <nav className="flex flex-wrap items-center gap-2 text-sm" style={{ color: "var(--sf-muted)" }} aria-label="Breadcrumb">
        <Link href={base} className="hover:underline">{data.shop.name}</Link>
        <span aria-hidden>/</span>
        <Link href={`${base}/blog`} className="hover:underline">Blog / Vlog</Link>
        <span aria-hidden>/</span>
        <span>{post.title}</span>
      </nav>
      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--sf-primary)]">Blog / Vlog</p>
      <p className="mt-3 text-sm" style={{ color: "var(--sf-muted)" }}>
        {formatDate(post.published_at)}
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">{post.title}</h1>
      {post.excerpt ? (
        <p className="mt-4 text-lg leading-8" style={{ color: "var(--sf-muted)" }}>
          {post.excerpt}
        </p>
      ) : null}
      {blogMediaUrl(post) ? (
        <MediaPreview
          url={blogMediaUrl(post) || ""}
          title={post.title}
          playing
          className={`${mediaFrameClass(blogMediaUrl(post) || "")} mt-8 rounded-[28px]`}
        />
      ) : null}
      <div className="mt-8 whitespace-pre-wrap text-base leading-8">{post.body}</div>
    </article>
  );
}
