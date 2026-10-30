import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui/primitives";
import { formatDate } from "@/lib/format";

export default async function AdminNewsPage() {
  await requireRole("admin");
  const supabase = await createServerSupabase();
  const { data: articles } = await supabase.from("lagecto_news_articles").select("*").order("created_at", { ascending: false });

  return (
    <>
      <PageHeader
        title="News CMS"
        subtitle="Publish for all, customers, shop owners or guests."
        action={
          <Link href="/admin/news/new" className="rounded-full bg-[#0B6E4F] px-4 py-2 text-white">
            New article
          </Link>
        }
      />
      {!articles?.length ? (
        <EmptyState title="No articles" body="Write a LaGecto News article." />
      ) : (
        <div className="grid gap-3">
          {articles.map((article) => (
            <Link key={article.id} href={`/admin/news/${article.id}`} className="rounded-2xl bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{article.title}</p>
                <StatusBadge value={article.status} />
              </div>
              <p className="text-sm text-[#6B7280]">{article.audience} · {formatDate(article.created_at)}</p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
