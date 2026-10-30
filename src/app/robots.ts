import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/format";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: ["WhatsApp", "facebookexternalhit", "Facebot", "Twitterbot", "LinkedInBot", "Slackbot"],
        allow: "/",
      },
      {
        userAgent: "*",
        allow: [
          "/",
          "/s/",
          "/marketplace",
          "/shops",
          "/support",
          "/about",
          "/how-it-works",
          "/features",
          "/for-customers",
          "/for-shops",
          "/help",
          "/contact",
          "/login",
          "/signup",
        ],
        disallow: ["/customer", "/shop", "/admin", "/app", "/api"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
