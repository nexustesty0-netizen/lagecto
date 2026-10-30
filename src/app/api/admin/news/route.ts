import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiProfile } from "@/lib/auth/session";
import { parsePublicHttpsUrl } from "@/lib/media";

export async function POST(request: Request) {
  const auth = await requireApiProfile("admin");
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  const articleBody = String(body.body || "").trim();
  if (!title || !articleBody) return NextResponse.json({ error: "Title and body are required." }, { status: 400 });
  const status = ["draft", "published", "scheduled", "unpublished", "archived"].includes(String(body.status))
    ? String(body.status)
    : "draft";
  const videoUrl = String(body.videoUrl || "").trim();
  if (videoUrl) {
    const parsed = parsePublicHttpsUrl(videoUrl);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const scheduledAt = status === "scheduled" && body.scheduledAt ? new Date(body.scheduledAt).toISOString() : null;
  if (status === "scheduled" && !scheduledAt) {
    return NextResponse.json({ error: "Choose a schedule time." }, { status: 400 });
  }
  const payload = {
    title,
    excerpt: String(body.excerpt || "").slice(0, 400),
    body: articleBody,
    audience: String(body.audience || "all"),
    category: String(body.category || "platform"),
    status,
    cover_image_url: String(body.coverImageUrl || "") || null,
    video_url: videoUrl || null,
    featured: Boolean(body.featured),
    scheduled_at: scheduledAt,
    published_at: status === "published" ? new Date().toISOString() : status === "archived" || status === "unpublished" ? null : undefined,
    created_by: auth.profile.id,
    slug: String(body.slug || "").trim() || String(title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || null,
    seo_title: String(body.seoTitle || "").trim() || null,
    seo_description: String(body.seoDescription || "").trim() || null,
    tags: String(body.tags || "")
      .split(",")
      .map((tag: string) => tag.trim())
      .filter(Boolean),
    author_name: String(body.authorName || "LaGecto Editorial").trim(),
  };
  const supabase = await createServerSupabase();
  if (body.id) {
    const { error } = await supabase.from("lagecto_news_articles").update(payload).eq("id", body.id);
    if (error) return NextResponse.json({ error: "Unable to update this article." }, { status: 400 });
  } else {
    const { error } = await supabase.from("lagecto_news_articles").insert(payload);
    if (error) return NextResponse.json({ error: "Unable to create this article." }, { status: 400 });
  }
  await supabase.rpc("log_security_event", {
    p_event_type: status === "published" ? "admin_news_publish" : "admin_news_save",
    p_actor_id: auth.profile.id,
    p_identifier: title.slice(0, 80),
    p_result: "success",
    p_metadata: { status },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await requireApiProfile("admin");
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("lagecto_news_articles").delete().eq("id", String(body.id || ""));
  if (error) return NextResponse.json({ error: "Unable to delete this article." }, { status: 400 });
  await supabase.rpc("log_security_event", {
    p_event_type: "admin_news_delete",
    p_actor_id: auth.profile.id,
    p_result: "success",
    p_metadata: { id: body.id },
  });
  return NextResponse.json({ ok: true });
}
