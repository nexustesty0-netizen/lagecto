import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStorefrontBySlug } from "@/lib/storefront/load";
import { storefrontOgDescription } from "@/lib/storefront/og";
import { storefrontShareOrigin, storefrontShareUrl } from "@/lib/storefront/socials";
import { absoluteUrl, ogImages } from "@/lib/share-preview";
import { StorefrontFooter } from "@/components/storefront/StorefrontFooter";
import { TechNav, TechWhatsAppButton } from "@/components/storefront/tech/TechChrome";
import { applyTechTheme, techCopyFor } from "@/lib/storefront/template";
import { BRAND } from "@/lib/brand";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getStorefrontBySlug(slug);
  if (!data) return { title: "Shop" };
  const title = data.shop.meta_title || data.shop.name;
  const description = storefrontOgDescription({
    name: data.shop.name,
    meta_description: data.shop.meta_description,
    tagline: data.config?.tagline,
    about: data.shop.about,
  });
  const url = storefrontShareUrl(undefined, slug);
  const generated = absoluteUrl(`/s/${slug}/opengraph-image`);
  const images = ogImages(data.shop.banner_url || data.shop.logo_url, title) || [{ url: generated, width: 1200, height: 630, alt: title }];
  return {
    title,
    description,
    metadataBase: new URL(storefrontShareOrigin()),
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "en_ZW",
      url,
      siteName: BRAND.name,
      title,
      description,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images.map((item) => item.url),
    },
  };
}

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<unknown>;
}) {
  const { slug } = (await params) as { slug: string };
  const data = await getStorefrontBySlug(slug);
  if (!data) notFound();
  const showProducts = data.shop.provider_type !== "services";
  const showServices = data.shop.provider_type !== "products";
  const theme = applyTechTheme(data.shop, data.config, data.theme);

  return (
    <div className="storefront-root sf-tech flex min-h-full flex-col" style={theme.cssVars}>
      <TechNav shop={data.shop} showProducts={showProducts} showServices={showServices} />
      <main id="main" className="flex-1">{children}</main>
      <StorefrontFooter shop={data.shop} showProducts={showProducts} showServices={showServices} />
      <TechWhatsAppButton shop={data.shop} message={techCopyFor(data.shop).whatsappMessage} />
    </div>
  );
}
