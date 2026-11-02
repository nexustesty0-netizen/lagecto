import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStorefrontBySlug } from "@/lib/storefront/load";
import { StorefrontLegalPage } from "@/components/storefront/StorefrontLegalPage";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getStorefrontBySlug(slug);
  if (!data) return { title: "Terms" };
  return { title: `Terms · ${data.shop.name}` };
}

export default async function StorefrontTermsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getStorefrontBySlug(slug);
  if (!data) notFound();
  return (
    <StorefrontLegalPage
      shop={data.shop}
      title="Terms of service"
      empty={`${data.shop.name} has not published terms of service yet.`}
      body={data.shop.terms_of_service}
    />
  );
}
