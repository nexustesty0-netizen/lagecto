import { sanitizeHttpUrl } from "@/lib/storefront/socials";

export type LinkedPart = {
  text: string;
  href?: string;
};

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, "");
}

function safeHref(raw: string) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.includes("\\")) {
    if (trimmed.includes("://") || trimmed.includes("javascript:")) return "";
    return trimmed;
  }
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return sanitizeHttpUrl(withScheme);
}

export function linkifyNewsText(input: string): LinkedPart[] {
  const source = String(input || "")
    .replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => `[${stripTags(String(label))}](${href})`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "");

  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<]+)|(www\.[^\s<]+)/gi;
  const parts: LinkedPart[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    if (match.index > last) parts.push({ text: source.slice(last, match.index) });
    if (match[1] && match[2]) {
      const href = safeHref(match[2]);
      parts.push(href ? { text: match[1], href } : { text: match[0] });
    } else {
      const raw = match[3] || match[4] || "";
      const trailing = raw.match(/[),.;!?]+$/)?.[0] || "";
      const core = trailing ? raw.slice(0, -trailing.length) : raw;
      const href = safeHref(core);
      if (href) {
        parts.push({ text: core, href });
        if (trailing) parts.push({ text: trailing });
      } else {
        parts.push({ text: raw });
      }
    }
    last = match.index + match[0].length;
  }
  if (last < source.length) parts.push({ text: source.slice(last) });
  return parts.length ? parts : [{ text: source }];
}
