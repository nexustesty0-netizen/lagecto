"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { MediaField } from "@/components/media/MediaField";
import { StorefrontLogo, StorefrontHeroBackdrop } from "@/components/storefront/StorefrontChrome";
import { resolveStorefrontTheme, isHexColor } from "@/lib/storefront/theme";
import { shopHref } from "@/lib/storefront/paths";

type Config = {
  hero_title: string | null;
  hero_subtitle: string | null;
  tagline: string | null;
  cover_position: string | null;
  cta_label: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  background_color: string | null;
  is_published: boolean | null;
};

export function StorefrontBuilder({
  shop,
  config,
}: {
  shop: {
    id: string;
    name: string;
    slug?: string | null;
    about: string | null;
    logo_url: string | null;
    banner_url: string | null;
    meta_title?: string | null;
    meta_description?: string | null;
  };
  config: Config | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [logo, setLogo] = useState<string | null>(shop.logo_url);
  const [cover, setCover] = useState<string | null>(shop.banner_url);
  const [coverPosition, setCoverPosition] = useState(config?.cover_position || "center");
  const [primary, setPrimary] = useState(config?.primary_color || "#0B6E4F");
  const [secondary, setSecondary] = useState(config?.secondary_color || "#2E8B57");
  const [accent, setAccent] = useState(config?.accent_color || "#D4AF37");
  const [background, setBackground] = useState(config?.background_color || "#FFFDF8");
  const theme = useMemo(
    () => resolveStorefrontTheme({ primary, secondary, accent, background }),
    [primary, secondary, accent, background],
  );

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (![primary, secondary, accent, background].every((value) => isHexColor(value))) {
      setMessage("Use six-digit hex colors, for example #0B6E4F.");
      return;
    }
    const supabase = createBrowserSupabase();
    const [{ error: shopError }, { error: configError }] = await Promise.all([
      supabase
        .from("shops")
        .update({
          logo_url: logo,
          banner_url: cover,
          about: String(form.get("about") || ""),
          slug: String(form.get("slug") || shop.slug || ""),
          meta_title: String(form.get("meta_title") || ""),
          meta_description: String(form.get("meta_description") || ""),
        })
        .eq("id", shop.id),
      supabase.from("shop_storefront_config").upsert({
        shop_id: shop.id,
        hero_title: String(form.get("hero_title") || ""),
        hero_subtitle: String(form.get("hero_subtitle") || ""),
        tagline: String(form.get("tagline") || ""),
        cta_label: String(form.get("cta_label") || "Shop now"),
        cover_position: String(form.get("cover_position") || "center"),
        primary_color: theme.primary,
        secondary_color: theme.secondary,
        accent_color: theme.accent,
        background_color: theme.background,
        is_published: form.get("is_published") === "on",
        updated_at: new Date().toISOString(),
      }),
    ]);
    setMessage(shopError || configError ? "Unable to save storefront." : "Storefront saved.");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="grid gap-5">
        <section className="lg-card grid gap-4 p-5">
          <h2 className="font-semibold">Logo and cover</h2>
          <MediaField label="Shop logo" purpose="logo" value={logo} onChange={setLogo} hint="Small icon on your banner and in the storefront navbar." />
          <MediaField label="Cover / hero image" purpose="cover" value={cover} onChange={setCover} hint="This is how your shop appears — the large image on listings and the shop home page." />
          <label className="grid gap-1 text-sm">
            Cover focus
            <select
              name="cover_position"
              value={coverPosition}
              onChange={(event) => setCoverPosition(event.target.value)}
              className="rounded-xl border px-3 py-2"
            >
              <option value="center">Center</option>
              <option value="top">Top</option>
              <option value="bottom">Bottom</option>
            </select>
          </label>
        </section>
        <section className="lg-card grid gap-4 p-5">
          <h2 className="font-semibold">Brand colors</h2>
          <p className="text-sm text-[var(--lagecto-muted)]">These colors style your storefront only. LaGecto stays LaGecto everywhere else. Text and buttons auto-adjust for contrast.</p>
          {[
            { label: "Primary", value: primary, set: setPrimary, name: "primary_color" },
            { label: "Secondary", value: secondary, set: setSecondary, name: "secondary_color" },
            { label: "Accent", value: accent, set: setAccent, name: "accent_color" },
            { label: "Background", value: background, set: setBackground, name: "background_color" },
          ].map((color) => (
            <label key={color.name} className="flex items-center justify-between gap-3 text-sm">
              {color.label}
              <span className="flex items-center gap-2">
                <input type="color" value={color.value} onChange={(event) => color.set(event.target.value.toUpperCase())} aria-label={color.label} />
                <input value={color.value} onChange={(event) => color.set(event.target.value.toUpperCase())} className="w-28 rounded-xl border px-2 py-1 font-mono text-xs" />
              </span>
            </label>
          ))}
        </section>
        <section className="lg-card grid gap-3 p-5">
          <h2 className="font-semibold">Shop information</h2>
          <input name="hero_title" defaultValue={config?.hero_title || shop.name} placeholder="Hero title" className="rounded-xl border px-3 py-2" />
          <input name="tagline" defaultValue={config?.tagline || ""} placeholder="Short description" className="rounded-xl border px-3 py-2" />
          <textarea name="hero_subtitle" defaultValue={config?.hero_subtitle || ""} placeholder="Hero subtitle" className="min-h-20 rounded-xl border px-3 py-2" />
          <textarea name="about" defaultValue={shop.about || ""} placeholder="About the shop" className="min-h-24 rounded-xl border px-3 py-2" />
          <input name="cta_label" defaultValue={config?.cta_label || "Shop now"} placeholder="Button label" className="rounded-xl border px-3 py-2" />
          <input name="slug" defaultValue={shop.slug || ""} placeholder="storefront-url" className="rounded-xl border px-3 py-2" />
          <p className="text-xs text-[var(--lagecto-muted)]">Public URL: {shop.slug ? shopHref(shop) : "/s/your-shop"}</p>
          <input name="meta_title" defaultValue={shop.meta_title || ""} placeholder="SEO title" className="rounded-xl border px-3 py-2" />
          <textarea name="meta_description" defaultValue={shop.meta_description || ""} placeholder="SEO description" className="min-h-16 rounded-xl border px-3 py-2" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_published" defaultChecked={config?.is_published !== false} />
            Publish storefront
          </label>
          <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Save appearance</button>
          {message ? <p className="text-sm text-[#0B6E4F]">{message}</p> : null}
        </section>
      </div>
      <aside className="lg:sticky lg:top-24">
        <div className="overflow-hidden rounded-[28px] border shadow-[var(--lg-shadow)]" style={theme.cssVars}>
          <div className="relative h-56 overflow-hidden" style={{ background: theme.primary }}>
            <StorefrontHeroBackdrop bannerUrl={cover} coverPosition={coverPosition} />
            <div className="absolute left-4 top-4">
              <StorefrontLogo shop={{ name: shop.name, logo_url: logo }} size={36} className="shadow-md ring-2 ring-white/90" />
            </div>
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <p className="text-xl font-semibold">{shop.name}</p>
              <p className="text-sm text-white/85">{cover ? "Your banner, with the shop logo as a small icon" : "Upload a cover image to show it here"}</p>
              <div className="mt-3 flex gap-2">
                <span className="rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ background: "#04180f" }}>
                  Shop now
                </span>
                <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold" style={{ color: theme.primary }}>
                  Contact
                </span>
              </div>
            </div>
          </div>
          <div className="grid gap-3 p-4" style={{ background: theme.background, color: theme.text }}>
            <div className="sf-card p-4">
              <p className="text-sm" style={{ color: theme.muted }}>
                Navigation, product cards and buttons use your colors with automatic readable text.
              </p>
            </div>
            <div className="flex gap-2">
              <span className="h-8 w-8 rounded-full" style={{ background: theme.primary }} />
              <span className="h-8 w-8 rounded-full" style={{ background: theme.secondary }} />
              <span className="h-8 w-8 rounded-full" style={{ background: theme.accent }} />
            </div>
          </div>
        </div>
        {shop.slug ? (
          <a href={shopHref(shop)} className="mt-3 inline-block text-sm font-medium text-[#0B6E4F]">
            Open live storefront
          </a>
        ) : null}
      </aside>
    </form>
  );
}
