import { NewsFeed } from "@/components/news/NewsFeed";

export default async function CustomerNewsPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const { q, category } = await searchParams;
  return <NewsFeed title="LaGecto News" audience={["all", "customers"]} hrefBase="/customer/news" q={q} category={category} />;
}
