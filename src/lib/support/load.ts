import { createServerSupabase } from "@/lib/supabase/server";
import { CONTACT } from "@/lib/brand";

export type FaqRow = {
  id: string;
  section: string;
  audience: string;
  question: string;
  answer: string;
  featured: boolean | null;
  sort_order: number | null;
};

export async function loadSupportContact() {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("lagecto_company_profile")
    .select("support_email, support_phone, company_name, tagline")
    .eq("id", 1)
    .maybeSingle();
  return {
    email: data?.support_email || CONTACT.email,
    phone: data?.support_phone || CONTACT.phoneDisplay,
    name: data?.company_name || "LaGecto",
    tagline: data?.tagline || "Smart shopping, khula nathi mhlobo",
  };
}

export async function loadFaqs(audience?: string) {
  const supabase = await createServerSupabase();
  const full = await supabase
    .from("faq_entries")
    .select("id, section, audience, question, answer, featured, sort_order, is_archived")
    .eq("is_published", true)
    .order("featured", { ascending: false })
    .order("sort_order");
  const fallback = full.error
    ? await supabase
        .from("faq_entries")
        .select("id, section, audience, question, answer, sort_order")
        .eq("is_published", true)
        .order("sort_order")
    : null;
  const data = (full.data || fallback?.data || []) as (FaqRow & { is_archived?: boolean })[];
  return data.filter((row) => {
    if (row.is_archived) return false;
    return !audience || audience === "all" || row.audience === "all" || row.audience === audience;
  });
}

export async function loadHelpArticles(kind?: "article" | "troubleshooting") {
  const supabase = await createServerSupabase();
  let query = supabase
    .from("help_articles")
    .select("id, slug, kind, title, summary, body, category, audience")
    .eq("is_published", true)
    .eq("is_archived", false)
    .order("sort_order");
  if (kind) query = query.eq("kind", kind);
  const { data } = await query;
  return data || [];
}

export async function loadHelpArticle(slug: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("help_articles")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .eq("is_archived", false)
    .maybeSingle();
  return data;
}

export async function loadAbout(slug: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("about_content").select("*").eq("slug", slug).eq("status", "published").maybeSingle();
  return data;
}

export async function loadLegal(slug: string) {
  const supabase = await createServerSupabase();
  const { data: current } = await supabase
    .from("legal_document_versions")
    .select("id, version, effective_on, content, published_at, status, document_slug")
    .eq("document_slug", slug)
    .eq("status", "published")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: history } = await supabase
    .from("legal_document_versions")
    .select("id, version, effective_on, status, published_at")
    .eq("document_slug", slug)
    .in("status", ["published", "archived"])
    .order("version", { ascending: false });
  return { current, history: history || [] };
}

export async function loadLegalVersion(slug: string, version: number) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("legal_document_versions")
    .select("*")
    .eq("document_slug", slug)
    .eq("version", version)
    .in("status", ["published", "archived"])
    .maybeSingle();
  return data;
}

export async function loadMyCases(userId: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("support_cases")
    .select("id, ticket_number, kind, category, subject, status, priority, created_at, updated_at")
    .eq("reporter_user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(80);
  return data || [];
}

export async function loadMyCase(id: string, userId: string, isAdmin: boolean) {
  const supabase = await createServerSupabase();
  const query = supabase.from("support_cases").select("*").eq("id", id);
  const { data: ticket } = await (isAdmin ? query : query.eq("reporter_user_id", userId)).maybeSingle();
  if (!ticket) return null;
  const { data: messages } = await supabase
    .from("support_messages")
    .select("id, body, is_staff, created_at, author_id")
    .eq("case_id", id)
    .order("created_at");
  const notes = isAdmin
    ? (
        await supabase.from("support_internal_notes").select("id, body, created_at, author_id").eq("case_id", id).order("created_at")
      ).data
    : [];
  return { ticket, messages: messages || [], notes: notes || [] };
}

export async function loadSimilarBugs(ticket: { id: string; area?: string | null; subject: string; description: string }) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("support_cases")
    .select("id, ticket_number, subject, description, area, status, created_at")
    .eq("kind", "bug")
    .neq("id", ticket.id)
    .eq("area", ticket.area || "other")
    .order("created_at", { ascending: false })
    .limit(24);
  const needle = ticket.subject.toLowerCase().slice(0, 24);
  const desc = ticket.description.toLowerCase().slice(0, 48);
  return (data || [])
    .filter((row) => {
      const subject = String(row.subject || "").toLowerCase();
      const body = String(row.description || "").toLowerCase();
      return (
        subject === ticket.subject.toLowerCase() ||
        (needle.length > 6 && subject.slice(0, 24) === needle) ||
        (desc.length > 12 && body.slice(0, 48) === desc)
      );
    })
    .slice(0, 6);
}
