import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, StatCard, EmptyState, StatusBadge } from "@/components/ui/primitives";
import { AdminFaqForm, AdminArticleForm, AdminAboutForm, AdminLegalForm, PublishLegalButton } from "@/components/admin/AdminHelpCms";
import { formatDate, formatDateTime } from "@/lib/format";

const TABS = [
  ["overview", "Overview"],
  ["tickets", "Tickets"],
  ["bugs", "Bug reports"],
  ["shop_reports", "Shop reports"],
  ["feedback", "Feedback"],
  ["faqs", "FAQs"],
  ["articles", "Articles"],
  ["legal", "Legal & About"],
] as const;

function kindForTab(tab: string) {
  if (tab === "bugs") return "bug";
  if (tab === "shop_reports") return "shop_report";
  if (tab === "feedback") return "feedback";
  if (tab === "tickets") return "support";
  return "";
}

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; status?: string; sort?: string }>;
}) {
  const profile = await requireRole("admin");
  const { tab: rawTab, q, status, sort } = await searchParams;
  const tab = TABS.some((item) => item[0] === rawTab) ? rawTab || "overview" : "overview";
  const supabase = await createServerSupabase();
  const [{ data: analytics }, { data: legalOk }] = await Promise.all([
    supabase.rpc("support_analytics_admin"),
    supabase.rpc("is_legal_admin"),
  ]);
  const stats = (analytics || {}) as {
    open_tickets?: number;
    high_priority?: number;
    bugs?: number;
    shop_reports?: number;
    feedback?: number;
    resolved?: number;
    avg_resolution_hours?: number | null;
  };

  let cases: Record<string, unknown>[] = [];
  if (["tickets", "bugs", "shop_reports", "feedback"].includes(tab)) {
    let query = supabase
      .from("support_cases")
      .select("id, ticket_number, kind, category, subject, status, priority, severity, area, created_at, updated_at, shop_id, reporter_user_id, shops(name, login_shop_id)")
      .order(sort === "created" ? "created_at" : "updated_at", { ascending: false })
      .limit(80);
    const kind = kindForTab(tab);
    if (kind === "support") query = query.in("kind", ["support", "technical"]);
    else if (kind) query = query.eq("kind", kind);
    if (status) query = query.eq("status", status);
    if (q) {
      const safe = q.replace(/[%(),]/g, "").slice(0, 40);
      if (safe) query = query.or(`ticket_number.ilike.%${safe}%,subject.ilike.%${safe}%,category.ilike.%${safe}%`);
    }
    const { data } = await query;
    cases = data || [];
  }

  const faqs = tab === "faqs" ? (await supabase.from("faq_entries").select("*").order("section").order("sort_order")).data || [] : [];
  const articles = tab === "articles" ? (await supabase.from("help_articles").select("*").order("kind").order("sort_order")).data || [] : [];
  const about = tab === "legal" ? (await supabase.from("about_content").select("*").order("slug")).data || [] : [];
  const legal = tab === "legal" ? (await supabase.from("legal_document_versions").select("*").order("document_slug").order("version", { ascending: false })).data || [] : [];

  return (
    <div className="admin-console">
      <PageHeader title="Support Centre" subtitle="Tickets, bugs, shop safety reports, feedback, and Help content. Counts are live — empty means nothing is waiting." />
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map(([id, label]) => (
          <Link key={id} href={id === "overview" ? "/admin/support" : `/admin/support?tab=${id}`} className={`rounded-full px-4 py-2 text-sm ${tab === id ? "bg-[#0B6E4F] text-white" : "border bg-white"}`}>
            {label}
          </Link>
        ))}
      </div>

      {tab === "overview" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Open tickets" value={String(stats.open_tickets || 0)} hint="Support and technical" />
            <StatCard label="High priority" value={String(stats.high_priority || 0)} hint="High and urgent still open" />
            <StatCard label="Shop reports" value={String(stats.shop_reports || 0)} hint="Customer allegations in review" />
            <StatCard label="Bug reports" value={String(stats.bugs || 0)} hint="Not resolved or closed" />
            <StatCard label="Feedback" value={String(stats.feedback || 0)} hint="All time" />
            <StatCard label="Resolved" value={String(stats.resolved || 0)} hint="Resolved or closed" />
            <StatCard
              label="Avg resolution"
              value={stats.avg_resolution_hours == null ? "—" : `${Number(stats.avg_resolution_hours).toFixed(1)}h`}
              hint={stats.avg_resolution_hours == null ? "Appears after tickets are resolved" : "Support and technical only"}
            />
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Link href="/admin/support?tab=tickets&status=open" className="lg-card p-4">
              <p className="text-sm text-[var(--lagecto-muted)]">Customer support</p>
              <p className="mt-1 font-semibold">Open the ticket queue</p>
            </Link>
            <Link href="/admin/support?tab=shop_reports" className="lg-card p-4">
              <p className="text-sm text-[var(--lagecto-muted)]">Shop safety</p>
              <p className="mt-1 font-semibold">Review shop reports</p>
            </Link>
            <Link href="/admin/support?tab=bugs" className="lg-card p-4">
              <p className="text-sm text-[var(--lagecto-muted)]">Product quality</p>
              <p className="mt-1 font-semibold">Triage bug reports</p>
            </Link>
          </div>
        </>
      ) : null}

      {["tickets", "bugs", "shop_reports", "feedback"].includes(tab) ? (
        <>
          <form className="mb-4 flex flex-wrap gap-2" action="/admin/support">
            <input type="hidden" name="tab" value={tab} />
            <input name="q" defaultValue={q} placeholder="Search ticket, subject, category" className="min-w-48 flex-1 rounded-full border px-4 py-2" />
            <input name="status" defaultValue={status} placeholder="Status" className="rounded-full border px-4 py-2" />
            <select name="sort" defaultValue={sort || "updated"} className="rounded-full border px-4 py-2">
              <option value="updated">Last updated</option>
              <option value="created">Created</option>
            </select>
            <button className="rounded-full bg-[#0B6E4F] px-4 py-2 text-white">Filter</button>
          </form>
          {!cases.length ? (
            <EmptyState title="Nothing in this queue" body="When customers send requests, they appear here." />
          ) : (
            <ul className="grid gap-3">
              {cases.map((row) => {
                const shop = row.shops as { name?: string; login_shop_id?: string } | { name?: string; login_shop_id?: string }[] | null;
                const shopOne = Array.isArray(shop) ? shop[0] : shop;
                const tone =
                  row.priority === "urgent"
                    ? "border-l-4 border-l-[#C2413B]"
                    : row.priority === "high"
                      ? "border-l-4 border-l-[#C47B12]"
                      : row.kind === "shop_report"
                        ? "border-l-4 border-l-[#0B6E4F]"
                        : "";
                return (
                  <li key={String(row.id)}>
                    <Link href={`/admin/support/${row.id}`} className={`lg-card flex flex-wrap items-center justify-between gap-3 p-4 ${tone}`}>
                      <div>
                        <p className="font-mono text-xs text-[#0B6E4F]">{String(row.ticket_number)}</p>
                        <p className="font-semibold">{String(row.subject)}</p>
                        <p className="text-xs text-[var(--lagecto-muted)]">
                          {String(row.kind)} · {String(row.category)}
                          {shopOne?.name ? ` · ${shopOne.name}` : ""}
                          {shopOne?.login_shop_id ? ` · ${shopOne.login_shop_id}` : ""}
                          {" · "}
                          {formatDateTime(String(row.updated_at))}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <StatusBadge value={String(row.status)} />
                        <StatusBadge value={String(row.priority)} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : null}

      {tab === "faqs" ? (
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <AdminFaqForm />
          <ul className="grid gap-3">
            {faqs.map((faq) => (
              <li key={faq.id} className="lg-card p-4">
                <p className="font-semibold">{faq.question}</p>
                <p className="text-xs text-[var(--lagecto-muted)]">
                  {faq.section} · {faq.audience} · {faq.is_published ? "published" : "unpublished"}
                  {faq.is_archived ? " · archived" : ""}
                </p>
                <div className="mt-3">
                  <AdminFaqForm faq={faq} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === "articles" ? (
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <AdminArticleForm />
          <ul className="grid gap-3">
            {articles.map((article) => (
              <li key={article.id} className="lg-card p-4">
                <p className="font-semibold">{article.title}</p>
                <p className="text-xs text-[var(--lagecto-muted)]">
                  {article.kind} · {article.slug} · {article.is_published ? "published" : "draft"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === "legal" ? (
        <div className="grid gap-6">
          {about.map((page) => (
            <AdminAboutForm key={page.slug} page={page} />
          ))}
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h2 className="mb-2 font-semibold">Terms draft</h2>
              <AdminLegalForm slug="terms" canPublish={Boolean(legalOk)} />
            </div>
            <div>
              <h2 className="mb-2 font-semibold">Privacy draft</h2>
              <AdminLegalForm slug="privacy" canPublish={Boolean(legalOk)} />
            </div>
          </div>
          <ul className="grid gap-2">
            {legal.map((row) => (
              <li key={row.id} className="lg-card flex flex-wrap items-center justify-between gap-3 p-4">
                <p className="text-sm">
                  {row.document_slug} v{row.version} · {row.status} · {formatDate(row.effective_on)}
                </p>
                {Boolean(legalOk) && row.status === "draft" ? <PublishLegalButton versionId={row.id} /> : null}
              </li>
            ))}
          </ul>
          {!legalOk ? <p className="text-sm text-[var(--lagecto-muted)]">Legal publishing is limited to super admins.</p> : null}
          <p className="text-xs text-[var(--lagecto-muted)]">Signed in as {profile.email}. Legal text still needs human review before you treat it as binding.</p>
        </div>
      ) : null}
    </div>
  );
}
