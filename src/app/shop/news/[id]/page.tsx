import { NewsArticle } from "@/components/news/NewsArticle";

export default async function ShopNewsArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NewsArticle id={id} hrefBase="/shop/news" />;
}
