import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStorefrontBySlug } from "@/lib/storefront/load";
import { StorefrontLegalPage } from "@/components/storefront/StorefrontLegalPage";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getStorefrontBySlug(slug);
  if (!data) return { title: "Privacy" };
  return { title: `Privacy · ${data.shop.name}` };
}

export default async function StorefrontPrivacyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getStorefrontBySlug(slug);
  if (!data) notFound();
  return (
    <StorefrontLegalPage
      shop={data.shop}
      title="Privacy policy"
      empty={`${data.shop.name} has not published a privacy policy yet.`}
      body={data.shop.privacy_policy}
    />
  );
}
