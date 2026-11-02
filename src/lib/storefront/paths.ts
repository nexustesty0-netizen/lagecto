export function storefrontPath(slug: string, suffix = "") {
  const clean = String(slug || "").trim();
  const extra = suffix.startsWith("/") ? suffix : suffix ? `/${suffix}` : "";
  return `/s/${encodeURIComponent(clean)}${extra}`;
}

export function shopHref(shop: { slug?: string | null; id: string }, suffix = "") {
  if (shop.slug) return storefrontPath(shop.slug, suffix);
  return `/shops/${shop.id}${suffix ? `/${suffix}` : ""}`;
}

export function productHref(shop: { slug?: string | null; id: string }, productId: string) {
  if (shop.slug) return storefrontPath(shop.slug, `p/${productId}`);
  return `/shops/${shop.id}`;
}

export function storefrontNavLinks(
  slug: string,
  opts: { products?: boolean; services?: boolean } = {},
) {
  const base = storefrontPath(slug);
  return [
    { href: base, label: "Home" },
    ...(opts.products ? [{ href: `${base}/products`, label: "Products" }] : []),
    ...(opts.services ? [{ href: `${base}/services`, label: "Services" }] : []),
    ...(opts.services ? [{ href: `${base}/projects`, label: "Projects" }] : []),
    { href: `${base}/promotions`, label: "Promotions" },
    { href: `${base}/blog`, label: "Blog / Vlog" },
    { href: `${base}/about`, label: "About" },
    { href: `${base}/contact`, label: "Contact" },
  ];
}
