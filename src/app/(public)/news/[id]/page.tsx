import { NewsArticle } from "@/components/news/NewsArticle";
import { loadPublishedArticle } from "@/lib/news/load";
import { absoluteUrl, newsSharePath, newsShareUrl, ogImages } from "@/lib/share-preview";
import { BRAND } from "@/lib/brand";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const article = await loadPublishedArticle(id);
  if (!article) return { title: "News" };
  const title = article.seo_title || article.title;
  const description = article.seo_description || article.excerpt || `A story from ${BRAND.name} News.`;
  const url = newsShareUrl(article);
  const imagePath = `${newsSharePath(article)}/opengraph-image`;
  return {
    title,
    description,
    robots: { index: true, follow: true },
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      locale: "en_ZW",
      url,
      siteName: BRAND.name,
      title,
      description,
      publishedTime: article.published_at || undefined,
      images: ogImages(article.cover_image_url, title) || ogImages(imagePath, title),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImages(article.cover_image_url, title)?.map((item) => item.url) || [absoluteUrl(imagePath)],
    },
  };
}

export default async function PublicNewsArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NewsArticle id={id} hrefBase="/news" />;
}
