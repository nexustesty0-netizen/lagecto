export type StorefrontStoryShop = {
  about?: string | null;
  mission?: string | null;
  vision?: string | null;
  aim?: string | null;
  core_values?: string | null;
  service_delivery?: string | null;
};

export function storefrontStoryBlocks(shop: StorefrontStoryShop) {
  return [
    { title: "Mission", body: shop.mission },
    { title: "Vision", body: shop.vision },
    { title: "Aim", body: shop.aim },
    { title: "Core values", body: shop.core_values },
    { title: "How we work", body: shop.service_delivery },
  ].filter((block) => String(block.body || "").trim());
}

export function StorefrontStory({ shop }: { shop: StorefrontStoryShop }) {
  const blocks = storefrontStoryBlocks(shop);
  if (!blocks.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 pb-12">
      <h2 className="mb-5 text-2xl font-semibold">Who we are</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {blocks.map((block) => (
          <article key={block.title} className="sf-card p-5">
            <h3 className="font-semibold">{block.title}</h3>
            <p className="mt-2 whitespace-pre-line leading-7" style={{ color: "var(--sf-muted)" }}>
              {block.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
