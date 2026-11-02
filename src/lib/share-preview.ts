import { storefrontShareOrigin } from "@/lib/storefront/socials";

export function publicOrigin() {
  return storefrontShareOrigin();
}

export function absoluteUrl(pathOrUrl?: string | null, origin = publicOrigin()) {
  const raw = String(pathOrUrl || "").trim();
  if (!raw) return "";
  if (raw.startsWith("data:")) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  if (/^https?:\/\//i.test(raw)) return raw;
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${origin.replace(/\/$/, "")}${path}`;
}

export function ogImages(url?: string | null, alt?: string) {
  const href = absoluteUrl(url);
  if (!href) return undefined;
  return [{ url: href, width: 1200, height: 630, alt: alt || "" }];
}

export function newsSharePath(article: { id: string; slug?: string | null }) {
  return `/news/${article.slug || article.id}`;
}

export function newsShareUrl(article: { id: string; slug?: string | null }) {
  return absoluteUrl(newsSharePath(article));
}

export function shareLinks(url: string, title: string, body?: string | null) {
  const excerpt = String(body || "").replace(/\s+/g, " ").trim();
  const text = [title, excerpt, url].filter(Boolean).join("\n\n");
  return {
    url,
    text,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${title}\n${url}`)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  };
}
