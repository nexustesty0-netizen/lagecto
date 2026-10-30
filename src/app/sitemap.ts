import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/format";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    "",
    "/marketplace",
    "/shops",
    "/news",
    "/plans",
    "/support",
    "/support/faqs",
    "/support/about",
    "/support/terms",
    "/support/privacy",
    "/about",
    "/how-it-works",
    "/features",
    "/for-customers",
    "/for-shops",
    "/help",
    "/contact",
    "/login",
    "/signup",
  ].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "weekly",
    priority: path === "" || path === "/marketplace" ? 1 : 0.6,
  }));
}
