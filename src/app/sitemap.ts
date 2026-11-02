import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { SITEMAP_PATHS } from "@/lib/seo-paths.mjs";

async function publicShopEntries(base: string): Promise<MetadataRoute.Sitemap> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("shops")
      .select("slug")
      .eq("status", "active")
      .not("slug", "is", null)
      .limit(200);
    if (error || !data) return [];
    return data
      .filter((row) => row.slug)
      .map((row) => ({
        url: `${base}/s/${row.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const pages: MetadataRoute.Sitemap = SITEMAP_PATHS.map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "weekly",
    priority: path === "" || path === "/marketplace" ? 1 : path === "/register-shop" || path === "/plans" ? 0.8 : 0.6,
  }));
  const shops = await publicShopEntries(base);
  return [...pages, ...shops];
}
