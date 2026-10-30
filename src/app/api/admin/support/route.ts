import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiProfile } from "@/lib/auth/session";

export async function POST(request: Request) {
  const auth = await requireApiProfile("admin");
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  const supabase = await createServerSupabase();

  if (action === "update_case") {
    const { data, error } = await supabase.rpc("admin_update_support_case", {
      p_case_id: String(body.caseId || ""),
      p_patch: {
        status: body.status || "",
        priority: body.priority || "",
        severity: body.severity || "",
        assigned_to: body.assignedTo || "",
        duplicate_of: body.duplicateOf || "",
      },
    });
    if (error) return NextResponse.json({ error: "Unable to update this request." }, { status: 400 });
    if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === "internal_note") {
    const { data, error } = await supabase.rpc("admin_add_internal_note", {
      p_case_id: String(body.caseId || ""),
      p_body: String(body.body || ""),
    });
    if (error) return NextResponse.json({ error: "Unable to save this note." }, { status: 400 });
    if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === "save_faq") {
    const payload = {
      section: String(body.section || "general").slice(0, 40),
      audience: String(body.audience || "all").slice(0, 20),
      question: String(body.question || "").slice(0, 240),
      answer: String(body.answer || "").slice(0, 4000),
      sort_order: Number(body.sortOrder || 0),
      featured: Boolean(body.featured),
      is_published: body.published !== false,
      is_archived: Boolean(body.archived),
      updated_at: new Date().toISOString(),
    };
    if (!payload.question || !payload.answer) return NextResponse.json({ error: "Question and answer are required." }, { status: 400 });
    const query = body.id
      ? supabase.from("faq_entries").update(payload).eq("id", body.id)
      : supabase.from("faq_entries").insert(payload);
    const { error } = await query;
    if (error) return NextResponse.json({ error: "Unable to save this FAQ." }, { status: 400 });
    await supabase.rpc("log_security_event", {
      p_event_type: "faq_save",
      p_actor_id: auth.profile.id,
      p_identifier: payload.question.slice(0, 80),
      p_result: "success",
      p_metadata: { archived: payload.is_archived, published: payload.is_published },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "save_article") {
    const payload = {
      slug: String(body.slug || "").trim().slice(0, 80),
      kind: body.kind === "troubleshooting" ? "troubleshooting" : "article",
      title: String(body.title || "").slice(0, 160),
      summary: String(body.summary || "").slice(0, 400),
      body: String(body.body || "").slice(0, 20000),
      category: String(body.category || "general").slice(0, 40),
      audience: String(body.audience || "all").slice(0, 20),
      is_published: Boolean(body.published),
      is_archived: Boolean(body.archived),
      sort_order: Number(body.sortOrder || 0),
      updated_at: new Date().toISOString(),
    };
    if (!payload.slug || !payload.title || !payload.body) {
      return NextResponse.json({ error: "Slug, title and body are required." }, { status: 400 });
    }
    const query = body.id
      ? supabase.from("help_articles").update(payload).eq("id", body.id)
      : supabase.from("help_articles").insert({ ...payload, created_by: auth.profile.id });
    const { error } = await query;
    if (error) return NextResponse.json({ error: "Unable to save this article." }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === "save_about") {
    const slug = String(body.slug || "");
    if (!slug) return NextResponse.json({ error: "Missing page." }, { status: 400 });
    const { error } = await supabase.from("about_content").upsert({
      slug,
      title: String(body.title || "").slice(0, 160),
      body: String(body.body || "").slice(0, 20000),
      status: body.status === "draft" ? "draft" : "published",
      updated_by: auth.profile.id,
      updated_at: new Date().toISOString(),
    });
    if (error) return NextResponse.json({ error: "Unable to save this page." }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === "save_legal_draft") {
    const { data: legalOk } = await supabase.rpc("is_legal_admin");
    if (!legalOk) {
      return NextResponse.json({ error: "Only a super admin can change legal documents." }, { status: 403 });
    }
    const slug = String(body.slug || "");
    const content = String(body.content || "");
    if (!slug || !content) return NextResponse.json({ error: "Document content is required." }, { status: 400 });
    const { data: last } = await supabase
      .from("legal_document_versions")
      .select("version")
      .eq("document_slug", slug)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase.from("legal_document_versions").insert({
      document_slug: slug,
      version: Number(last?.version || 0) + 1,
      effective_on: body.effectiveOn || null,
      content,
      status: "draft",
    });
    if (error) return NextResponse.json({ error: "Unable to save this draft." }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === "publish_legal") {
    const { data, error } = await supabase.rpc("publish_legal_version", { p_version_id: String(body.versionId || "") });
    if (error) return NextResponse.json({ error: "Unable to publish." }, { status: 400 });
    if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
