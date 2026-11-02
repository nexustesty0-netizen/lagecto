import { StorefrontPageHeader } from "@/components/storefront/StorefrontPageHeader";
import type { StorefrontShop } from "@/lib/storefront/load";

export function StorefrontLegalPage({
  shop,
  title,
  empty,
  body,
}: {
  shop: StorefrontShop;
  title: string;
  empty: string;
  body?: string | null;
}) {
  const text = String(body || "").trim();
  const blocks = text.split(/\n{2,}/).filter(Boolean);
  return (
    <>
      <StorefrontPageHeader kicker={shop.name} title={title} subtitle={`Policies for ${shop.name}.`} image={shop.banner_url} />
      <article className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <div className="overflow-hidden rounded-[var(--lg-radius)] border bg-white p-6 sm:p-10" style={{ borderColor: "color-mix(in srgb, var(--sf-primary) 18%, transparent)" }}>
          {!text ? (
            <p className="text-sm leading-7" style={{ color: "var(--sf-muted)" }}>
              {empty}
            </p>
          ) : (
            <div className="grid gap-5 text-base leading-7">
              {blocks.map((block) => {
                const lines = block.split("\n");
                const heading = /^\d+\.\s/.test(lines[0] || "");
                if (heading) {
                  return (
                    <section key={block.slice(0, 48)}>
                      <h2 className="text-lg font-semibold">{lines[0]}</h2>
                      {lines.slice(1).join("\n").trim() ? (
                        <p className="mt-2 whitespace-pre-wrap" style={{ color: "var(--sf-text)" }}>
                          {lines.slice(1).join("\n")}
                        </p>
                      ) : null}
                    </section>
                  );
                }
                return (
                  <p key={block.slice(0, 48)} className="whitespace-pre-wrap">
                    {block}
                  </p>
                );
              })}
            </div>
          )}
        </div>
      </article>
    </>
  );
}
