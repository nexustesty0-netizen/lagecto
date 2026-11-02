import { NewsFeed } from "@/components/news/NewsFeed";

export default async function ShopNewsPage() {
  return <NewsFeed title="LaGecto News" audience={["all", "shop_owners"]} hrefBase="/shop/news" variant="app" />;
}
