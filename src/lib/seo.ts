import { BRAND, CONTACT } from "./brand";
import { siteUrl } from "./format";
import { NOINDEX_PATH_PREFIXES, SITEMAP_PATHS, isNoindexPath } from "./seo-paths.mjs";

export { NOINDEX_PATH_PREFIXES, SITEMAP_PATHS, isNoindexPath };

export function pageDescription(extra?: string) {
  return extra ? `${extra} ${BRAND.description}` : BRAND.description;
}

export function organizationJsonLd() {
  const url = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND.name,
    url,
    email: CONTACT.email,
    telephone: CONTACT.phoneDisplay,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Bulawayo",
      addressCountry: "ZW",
    },
    areaServed: "ZW",
  };
}

export function websiteJsonLd() {
  const url = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND.name,
    url,
    potentialAction: {
      "@type": "SearchAction",
      target: `${url}/marketplace?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}
