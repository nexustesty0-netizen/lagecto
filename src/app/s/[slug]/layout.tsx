import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStorefrontBySlug } from "@/lib/storefront/load";
import { storefrontOgDescription } from "@/lib/storefront/og";
import { storefrontShareOrigin, storefrontShareUrl } from "@/lib/storefront/socials";
import { StorefrontDock, StorefrontNav } from "@/components/storefront/StorefrontChrome";
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
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
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

  return (
    <div className="storefront-root min-h-full pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-8" style={data.theme.cssVars}>
      <StorefrontNav shop={data.shop} showProducts={showProducts} showServices={showServices} />
      <main id="main">{children}</main>
      <StorefrontDock shop={data.shop} showProducts={showProducts} showServices={showServices} />
      <p className="px-4 py-6 text-center text-[11px] no-print" style={{ color: "var(--sf-muted)" }}>
        {data.shop.name} storefront · powered by{" "}
        <Link href="/" className="font-semibold">
          {BRAND.name}
        </Link>
        {" · "}
        <Link href={`/support/report-shop?shop=${data.shop.id}`} className="opacity-80">
          Report shop
        </Link>
      </p>
    </div>
  );
}
