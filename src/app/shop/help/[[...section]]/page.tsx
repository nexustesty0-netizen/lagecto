import type { Metadata } from "next";
import { SupportRouter } from "@/components/support/SupportRouter";

export const metadata: Metadata = { title: "Help & Support" };

export default async function ShopHelpPage({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { section } = await params;
  const query = await searchParams;
  return <SupportRouter section={section || []} searchParams={query} basePath="/shop/help" audience="shop_owner" />;
}
