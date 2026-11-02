import type { Metadata } from "next";
import { NewsFeed } from "@/components/news/NewsFeed";
import { BRAND } from "@/lib/brand";
import { absoluteUrl } from "@/lib/share-preview";

export const metadata: Metadata = {
  title: "News",
  description: `Stories from ${BRAND.name} shops, the marketplace, and local commerce.`,
  alternates: { canonical: absoluteUrl("/news") },
  openGraph: {
    title: `${BRAND.name} News`,
    description: `Stories from ${BRAND.name} shops, the marketplace, and local commerce.`,
    url: absoluteUrl("/news"),
    siteName: BRAND.name,
    type: "website",
  },
};

export default async function PublicNewsPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const { q, category } = await searchParams;
  return (
    <NewsFeed
      title="LaGecto News"
      audience={["all", "guests", "customers", "shop_owners"]}
      hrefBase="/news"
      q={q}
      category={category}
      variant="public"
    />
  );
}
