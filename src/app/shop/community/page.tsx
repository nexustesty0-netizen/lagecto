import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { InsertForm } from "@/components/forms/InsertForm";
import { formatDate } from "@/lib/format";

export default async function ShopCommunityPage() {
  const { shop } = await getOwnedShop();
  if (!shop) return null;
  const supabase = await createServerSupabase();
  const { data: posts } = await supabase.from("business_posts").select("*").eq("shop_id", shop.id).order("created_at", { ascending: false });
  return (
    <>
      <PageHeader title="Community" subtitle="Posts your customers can see." />
      <InsertForm
        table="business_posts"
        extra={{ shop_id: shop.id }}
        fields={[
          { name: "title", placeholder: "Title", required: true, className: "md:col-span-4" },
          { name: "body", type: "textarea", placeholder: "Post" },
        ]}
      />
      {!posts?.length ? (
        <div className="mt-4">
          <EmptyState title="No posts" body="Share an update with customers." />
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {posts.map((row) => (
            <article key={row.id} className="rounded-2xl bg-white p-4">
              <p className="font-semibold">{row.title}</p>
              <p className="text-sm text-[#6B7280]">{row.body}</p>
              <p className="text-xs text-[#6B7280]">{formatDate(row.created_at)}</p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
