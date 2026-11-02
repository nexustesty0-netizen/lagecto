import type { LucideIcon } from "lucide-react";
import { Compass, Eye, Gem, Handshake, Target } from "lucide-react";

export type StorefrontStoryShop = {
  about?: string | null;
  mission?: string | null;
  vision?: string | null;
  aim?: string | null;
  core_values?: string | null;
  service_delivery?: string | null;
};

type StoryKey = "mission" | "vision" | "aim" | "values" | "delivery";

const STORY: Record<StoryKey, { title: string; Icon: LucideIcon; tone: "primary" | "secondary" | "accent" }> = {
  mission: { title: "Mission", Icon: Compass, tone: "primary" },
  vision: { title: "Vision", Icon: Eye, tone: "secondary" },
  aim: { title: "Aim", Icon: Target, tone: "accent" },
  values: { title: "Core values", Icon: Gem, tone: "primary" },
  delivery: { title: "How we work", Icon: Handshake, tone: "secondary" },
};

function toneVar(tone: "primary" | "secondary" | "accent") {
  if (tone === "secondary") return "var(--sf-secondary)";
  if (tone === "accent") return "var(--sf-accent)";
  return "var(--sf-primary)";
}

function splitValues(text: string) {
  const parts = String(text || "")
    .split(/\n+|•|●|;/)
    .map((item) => item.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean);
  return parts.length > 1 ? parts : [];
}

export function storefrontStoryBlocks(shop: StorefrontStoryShop) {
  return (["mission", "vision", "aim", "values", "delivery"] as const)
    .map((key) => {
      const body =
        key === "mission"
          ? shop.mission
          : key === "vision"
            ? shop.vision
            : key === "aim"
              ? shop.aim
              : key === "values"
                ? shop.core_values
                : shop.service_delivery;
      return { key, title: STORY[key].title, body };
    })
    .filter((block) => String(block.body || "").trim());
}

function StoryIcon({ tone, Icon }: { tone: "primary" | "secondary" | "accent"; Icon: LucideIcon }) {
  const color = toneVar(tone);
  return (
    <span
      className="grid h-12 w-12 place-items-center rounded-2xl"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 22%, transparent)`,
      }}
    >
      <Icon size={22} strokeWidth={1.75} />
    </span>
  );
}

export function StorefrontStory({ shop, embedded = false }: { shop: StorefrontStoryShop; embedded?: boolean }) {
  const blocks = storefrontStoryBlocks(shop);
  if (!blocks.length) return null;
  const featured = blocks.filter((block) => block.key === "mission" || block.key === "vision");
  const rest = blocks.filter((block) => block.key !== "mission" && block.key !== "vision");
  const content = (
    <>
      <div className={embedded ? "mb-5" : "mb-6"}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--sf-primary)" }}>
          About the shop
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Who we are</h2>
      </div>
      {featured.length ? (
        <div className={`grid gap-4 ${featured.length > 1 ? "md:grid-cols-2" : ""}`}>
          {featured.map((block) => {
            const meta = STORY[block.key];
            return (
              <article key={block.key} className="sf-card relative overflow-hidden p-6">
                <span
                  className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-40"
                  style={{ background: `color-mix(in srgb, ${toneVar(meta.tone)} 18%, transparent)` }}
                />
                <StoryIcon tone={meta.tone} Icon={meta.Icon} />
                <h3 className="mt-4 text-lg font-semibold">{block.title}</h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-7" style={{ color: "var(--sf-muted)" }}>
                  {block.body}
                </p>
              </article>
            );
          })}
        </div>
      ) : null}
      {rest.length ? (
        <div className={`grid gap-4 ${featured.length ? "mt-4" : ""}`}>
          {rest.map((block) => {
            const meta = STORY[block.key];
            const values = block.key === "values" ? splitValues(String(block.body)) : [];
            return (
              <article key={block.key} className="sf-card p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <StoryIcon tone={meta.tone} Icon={meta.Icon} />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-semibold">{block.title}</h3>
                    {values.length ? (
                      <ul className="mt-3 flex flex-wrap gap-2">
                        {values.map((value) => (
                          <li
                            key={value}
                            className="rounded-full px-3 py-1.5 text-sm"
                            style={{
                              background: `color-mix(in srgb, ${toneVar(meta.tone)} 12%, transparent)`,
                              color: "var(--sf-text)",
                            }}
                          >
                            {value}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 whitespace-pre-line text-sm leading-7" style={{ color: "var(--sf-muted)" }}>
                        {block.body}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </>
  );
  if (embedded) return <div className="sf-reveal mt-10">{content}</div>;
  return <section className="sf-reveal mx-auto max-w-6xl px-4 pb-16">{content}</section>;
}
