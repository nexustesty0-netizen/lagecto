import { CONTACT, shopWhatsAppUrl } from "@/lib/brand";
import { storefrontPath } from "@/lib/storefront/paths";

export function sanitizeHttpUrl(raw?: string | null) {
  const value = String(raw || "").trim();
  if (!value) return "";
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

export type ShopSocialFields = {
  name: string;
  website_url?: string | null;
  facebook_url?: string | null;
  youtube_url?: string | null;
  instagram_url?: string | null;
  tiktok_url?: string | null;
  linkedin_url?: string | null;
  twitter_url?: string | null;
  whatsapp_number?: string | null;
  phone?: string | null;
};

export type ShopSocialLink = {
  key: string;
  label: string;
  href: string;
};

export function shopSocialLinks(shop: ShopSocialFields): ShopSocialLink[] {
  const links: ShopSocialLink[] = [];
  const website = sanitizeHttpUrl(shop.website_url);
  const facebook = sanitizeHttpUrl(shop.facebook_url);
  const youtube = sanitizeHttpUrl(shop.youtube_url);
  const instagram = sanitizeHttpUrl(shop.instagram_url);
  const tiktok = sanitizeHttpUrl(shop.tiktok_url);
  const linkedin = sanitizeHttpUrl(shop.linkedin_url);
  const twitter = sanitizeHttpUrl(shop.twitter_url);
  const whatsapp = shopWhatsAppUrl(shop.whatsapp_number || shop.phone, `Hello ${shop.name}, I found you on LaGecto.`);
  if (website) links.push({ key: "website", label: "Website", href: website });
  if (facebook) links.push({ key: "facebook", label: "Facebook", href: facebook });
  if (instagram) links.push({ key: "instagram", label: "Instagram", href: instagram });
  if (youtube) links.push({ key: "youtube", label: "YouTube", href: youtube });
  if (tiktok) links.push({ key: "tiktok", label: "TikTok", href: tiktok });
  if (linkedin) links.push({ key: "linkedin", label: "LinkedIn", href: linkedin });
  if (twitter) links.push({ key: "x", label: "X", href: twitter });
  if (whatsapp) links.push({ key: "whatsapp", label: "WhatsApp", href: whatsapp });
  return links;
}

function isLocalHostUrl(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return true;
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const host = url.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local");
  } catch {
    return /localhost|127\.0\.0\.1/i.test(raw);
  }
}

export function storefrontShareOrigin(browserOrigin?: string) {
  const candidates = [process.env.NEXT_PUBLIC_SITE_URL, browserOrigin, CONTACT.website];
  for (const candidate of candidates) {
    const value = String(candidate || "")
      .trim()
      .replace(/\/$/, "");
    if (!value || isLocalHostUrl(value)) continue;
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  }
  return CONTACT.website.replace(/\/$/, "");
}

export function storefrontShareUrl(origin: string | undefined, slug: string) {
  return `${storefrontShareOrigin(origin)}${storefrontPath(slug)}`;
}

export function storefrontShareLinks(url: string, shopName: string) {
  const text = `Visit ${shopName} on LaGecto\n${url}`;
  return {
    copy: url,
    text,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  };
}
