import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { formatDate } from "@/lib/format";

export default async function CustomerCommunityPage() {
  await requireRole("customer");
  const supabase = await createServerSupabase();
  const { data: posts } = await supabase.from("business_posts").select("id, title, body, created_at, shops(name)").order("created_at", { ascending: false }).limit(40);
  return (
    <>
      <PageHeader title="Community" subtitle="Updates from shops on LaGecto." />
      {!posts?.length ? (
        <EmptyState title="No posts yet" body="Shop owners can publish community updates." />
      ) : (
        <div className="grid gap-3">
          {posts.map((post) => (
            <article key={post.id} className="rounded-2xl bg-white p-4">
              <p className="text-xs text-[#6B7280]">{(post.shops as { name?: string } | null)?.name}</p>
              <p className="font-semibold">{post.title}</p>
              <p className="text-sm text-[#6B7280]">{post.body}</p>
              <p className="text-xs">{formatDate(post.created_at)}</p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
