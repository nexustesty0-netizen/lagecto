import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStorefrontBySlug, getStorefrontCatalog, getStorefrontExtras } from "@/lib/storefront/load";
import { isTechStorefront, techPageTitle } from "@/lib/storefront/template";
import { TechAboutPage } from "@/components/storefront/tech/TechInnerPages";
import { storefrontOgDescription } from "@/lib/storefront/og";
import { StorefrontVideo } from "@/components/storefront/StorefrontVideo";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";
import { StorefrontStory } from "@/components/storefront/StorefrontStory";
import { StorefrontReviews } from "@/components/storefront/StorefrontReviews";
import { StorefrontSocialLinks } from "@/components/storefront/StorefrontSocialLinks";
import { ShareStorefrontButton } from "@/components/storefront/ShareStorefrontButton";
import { StorefrontPageHeader } from "@/components/storefront/StorefrontPageHeader";
import { StorefrontLogo } from "@/components/storefront/StorefrontChrome";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getStorefrontBySlug(slug);
  if (!data) return { title: "About" };
  return {
    title: isTechStorefront(data.shop, data.config) ? techPageTitle(data.shop, "about") : `About ${data.shop.name}`,
    description: storefrontOgDescription({
      name: data.shop.name,
      meta_description: data.shop.meta_description,
      tagline: data.config?.tagline,
      about: data.shop.about,
    }),
  };
}

export default async function StorefrontAboutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getStorefrontBySlug(slug);
  if (!data) notFound();
  const extras = await getStorefrontExtras(data.shop.id);
  const shop = data.shop;
  if (isTechStorefront(shop, data.config)) {
    const services = await getStorefrontCatalog(shop.id, "service");
    return <TechAboutPage shop={shop} config={data.config} media={extras.media} services={services} />;
  }
  return (
    <>
      <StorefrontPageHeader
        kicker="Our house"
        title={`About ${shop.name}`}
        subtitle={data.config?.tagline || "The people, the craft, and the way we work."}
        image={shop.banner_url}
      >
        <ShareStorefrontButton slug={shop.slug} shopName={shop.name} />
      </StorefrontPageHeader>
      <section className="mx-auto max-w-5xl px-4 pb-16">
        <div className="sf-card sf-reveal relative overflow-hidden p-6 sm:p-10">
          <div className="flex flex-wrap items-center gap-4">
            <StorefrontLogo shop={shop} size={72} className="shadow-md ring-1 ring-black/5" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold">{shop.name}</h2>
                <VerifiedBadge verified={shop.verified} />
              </div>
              <p className="mt-1 text-sm" style={{ color: "var(--sf-muted)" }}>
                {shop.category} · {shop.is_open ? "Open now" : "Closed now"}
              </p>
            </div>
          </div>
          <p className="mt-6 max-w-3xl text-lg leading-8">{shop.about || "This shop has not added an about section yet."}</p>
          <StorefrontSocialLinks shop={shop} className="mt-6" />
        </div>
        <StorefrontStory shop={shop} embedded />
        {extras.faqs.length ? (
          <div className="sf-reveal mt-12">
            <p className="sf-kicker">Questions</p>
            <h2 className="mt-2 text-3xl font-semibold">Ask us anything</h2>
            <div className="mt-6 grid gap-3">
              {extras.faqs.map((faq) => (
                <article key={faq.id} className="sf-card p-5 sm:p-6">
                  <p className="font-semibold">{faq.question}</p>
                  <p className="mt-2 text-sm leading-7" style={{ color: "var(--sf-muted)" }}>{faq.answer}</p>
                </article>
              ))}
            </div>
          </div>
        ) : null}
        {extras.videos.length ? (
          <div className="sf-reveal mt-12">
            <p className="sf-kicker">Behind the scenes</p>
            <h2 className="mb-6 mt-2 text-3xl font-semibold">How we work</h2>
            <div className="grid gap-4">
              {extras.videos.slice(0, 2).map((video) => (
                <StorefrontVideo key={video.id} title={video.title} url={video.url} />
              ))}
            </div>
          </div>
        ) : null}
        <div className="mt-12">
          <StorefrontReviews reviews={extras.reviews} embedded />
        </div>
      </section>
    </>
  );
}
