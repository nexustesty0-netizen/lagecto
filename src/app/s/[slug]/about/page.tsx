import { notFound } from "next/navigation";
import { getStorefrontBySlug, getStorefrontExtras } from "@/lib/storefront/load";
import { StorefrontVideo } from "@/components/storefront/StorefrontVideo";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";
import { storefrontStoryBlocks } from "@/components/storefront/StorefrontStory";
import { StorefrontReviews } from "@/components/storefront/StorefrontReviews";
import { StorefrontSocialLinks } from "@/components/storefront/StorefrontSocialLinks";
import { ShareStorefrontButton } from "@/components/storefront/ShareStorefrontButton";

export default async function StorefrontAboutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getStorefrontBySlug(slug);
  if (!data) notFound();
  const extras = await getStorefrontExtras(data.shop.id);
  const shop = data.shop;
  const story = storefrontStoryBlocks(shop);
  return (
    <section className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold">About {shop.name}</h1>
          <VerifiedBadge verified={shop.verified} />
        </div>
        <ShareStorefrontButton slug={shop.slug} shopName={shop.name} />
      </div>
      <p className="mt-4 leading-8">{shop.about || "This shop has not added an about section yet."}</p>
      <StorefrontSocialLinks shop={shop} className="mt-4" />
      {story.length ? (
        <div className="mt-6 grid gap-3">
          {story.map((block) => (
            <article key={block.title} className="sf-card p-5">
              <h2 className="font-semibold">{block.title}</h2>
              <p className="mt-2 whitespace-pre-line" style={{ color: "var(--sf-muted)" }}>{block.body}</p>
            </article>
          ))}
        </div>
      ) : null}
      {extras.faqs.length ? (
        <div className="mt-8 grid gap-3">
          <h2 className="text-xl font-semibold">Questions</h2>
          {extras.faqs.map((faq) => (
            <article key={faq.id} className="sf-card p-4">
              <p className="font-semibold">{faq.question}</p>
              <p className="mt-1 text-sm" style={{ color: "var(--sf-muted)" }}>{faq.answer}</p>
            </article>
          ))}
        </div>
      ) : null}
      {extras.videos.length ? (
        <div className="mt-8 grid gap-4">
          <h2 className="text-xl font-semibold">Behind the scenes</h2>
          {extras.videos.slice(0, 2).map((video) => (
            <StorefrontVideo key={video.id} title={video.title} url={video.url} />
          ))}
        </div>
      ) : null}
      <div className="mt-8">
        <StorefrontReviews reviews={extras.reviews} embedded />
      </div>
    </section>
  );
}
