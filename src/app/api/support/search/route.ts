import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const q = String(new URL(request.url).searchParams.get("q") || "").trim().slice(0, 80);
  const audience = new URL(request.url).searchParams.get("audience") || "all";
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("search_help", { p_query: q, p_audience: audience });
  if (!error && data) return NextResponse.json(data);

  const safe = q.replace(/[%_,().]/g, "");
  if (safe.length < 2) return NextResponse.json({ faqs: [], articles: [] });
  const { data: faqs } = await supabase
    .from("faq_entries")
    .select("id, section, question, answer")
    .eq("is_published", true)
    .ilike("question", `%${safe}%`)
    .limit(12);
  const articlesRes = await supabase
    .from("help_articles")
    .select("id, slug, kind, title, summary")
    .eq("is_published", true)
    .limit(8);
  return NextResponse.json({
    faqs: (faqs || []).map((row) => ({ ...row, excerpt: String(row.answer || "").slice(0, 280) })),
    articles: articlesRes.data || [],
  });
}
