import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig, isSupabaseConfigured } from "@/lib/env";
import type { NewsArticleRecord } from "@/lib/news/load";

export async function getNewsOgArticle(id: string): Promise<NewsArticleRecord | null> {
  if (!isSupabaseConfigured()) return null;
  const { url, anonKey } = getPublicSupabaseConfig();
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const uuid = /^[0-9a-f-]{36}$/i.test(id);
  let query = supabase
    .from("lagecto_news_articles")
    .select("id, title, excerpt, cover_image_url, category, slug, author_name, published_at, seo_title, seo_description")
    .eq("status", "published");
  query = uuid ? query.eq("id", id) : query.eq("slug", id);
  const { data } = await query.maybeSingle();
  return (data as NewsArticleRecord | null) ?? null;
}
