import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export type NewsArticleRecord = {
  id: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  cover_image_url: string | null;
  video_url?: string | null;
  category: string | null;
  audience?: string | null;
  featured?: boolean | null;
  slug: string | null;
  author_name: string | null;
  published_at: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  status?: string | null;
};

export async function loadPublishedArticle(id: string): Promise<NewsArticleRecord | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabase();
  const uuid = /^[0-9a-f-]{36}$/i.test(id);
  let query = supabase.from("lagecto_news_articles").select("*").eq("status", "published");
  query = uuid ? query.eq("id", id) : query.eq("slug", id);
  const { data } = await query.maybeSingle();
  return (data as NewsArticleRecord | null) ?? null;
}
