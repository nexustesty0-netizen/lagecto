import { NewsArticle } from "@/components/news/NewsArticle";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const uuid = /^[0-9a-f-]{36}$/i.test(id);
  const { data } = uuid
    ? await supabase.from("lagecto_news_articles").select("title, seo_title, seo_description, excerpt").eq("id", id).eq("status", "published").maybeSingle()
    : await supabase.from("lagecto_news_articles").select("title, seo_title, seo_description, excerpt").eq("slug", id).eq("status", "published").maybeSingle();
  if (!data) return { title: "News" };
  return {
    title: data.seo_title || data.title,
    description: data.seo_description || data.excerpt || undefined,
  };
}

export default async function PublicNewsArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <NewsArticle id={id} hrefBase="/news" />
    </div>
  );
}
