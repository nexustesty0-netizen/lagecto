import { NewsFeed } from "@/components/news/NewsFeed";

export default async function PublicNewsPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const { q, category } = await searchParams;
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <NewsFeed title="LaGecto News" audience={["all", "guests", "customers", "shop_owners"]} hrefBase="/news" q={q} category={category} />
    </div>
  );
}
