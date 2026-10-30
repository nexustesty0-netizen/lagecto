import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/primitives";
import { NewsEditor } from "@/components/admin/NewsEditor";

export default async function EditNewsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: article } = await supabase.from("lagecto_news_articles").select("*").eq("id", id).maybeSingle();
  if (!article) notFound();
  return (
    <>
      <PageHeader title="Edit article" />
      <NewsEditor article={article} />
    </>
  );
}
