import type { Metadata } from "next";
import { SupportRouter } from "@/components/support/SupportRouter";

export const metadata: Metadata = {
  title: "Help & Support",
  description: "FAQs, contact, terms, privacy and support for LaGecto customers and shop owners.",
};

export default async function SupportPage({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { section } = await params;
  const query = await searchParams;
  return <SupportRouter section={section || []} searchParams={query} basePath="/support" audience="all" />;
}
