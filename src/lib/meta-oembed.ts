import {
  canonicalFacebookUrlFromOembedHtml,
  facebookPermalink,
  facebookPluginSrc,
  isCanonicalFacebookVideoUrl,
  parseMediaEmbed,
  parsePublicHttpsUrl,
} from "@/lib/media";

export type FacebookPlayerPlan =
  | { mode: "iframe"; embed: string; href: string }
  | { mode: "sdk"; href: string }
  | { mode: "link"; href: string };

async function graphOembed(path: "oembed_video" | "oembed_post", url: string) {
  const endpoint = `https://graph.facebook.com/v25.0/${path}?omitscript=true&url=${encodeURIComponent(url)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { html?: string };
    return String(data.html || "");
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveFacebookPlayer(raw: string): Promise<FacebookPlayerPlan | null> {
  const parsed = parsePublicHttpsUrl(raw);
  if (!parsed.ok) return null;
  const media = parseMediaEmbed(raw);
  if (!media || media.provider !== "facebook") return null;
  const href = facebookPermalink(media.href);

  const html = (await graphOembed("oembed_video", href)) || (await graphOembed("oembed_post", href));
  const canonical = html ? canonicalFacebookUrlFromOembedHtml(html) : null;
  if (canonical) {
    return { mode: "iframe", embed: facebookPluginSrc(canonical), href: canonical };
  }
  if (isCanonicalFacebookVideoUrl(href)) {
    return { mode: "iframe", embed: facebookPluginSrc(href), href };
  }
  return { mode: "sdk", href };
}
