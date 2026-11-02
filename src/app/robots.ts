import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/format";
import { NOINDEX_PATH_PREFIXES } from "@/lib/seo-paths.mjs";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: ["WhatsApp", "facebookexternalhit", "Facebot", "Twitterbot", "LinkedInBot", "Slackbot"],
        allow: "/",
        disallow: ["/customer", "/shop", "/admin", "/app", "/api"],
      },
      {
        userAgent: "*",
        allow: "/",
        disallow: [...NOINDEX_PATH_PREFIXES],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
