import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { InsertForm } from "@/components/forms/InsertForm";

export default async function CategoriesPage() {
  const { shop } = await getOwnedShop();
  if (!shop) return null;
  const supabase = await createServerSupabase();
  const { data: categories } = await supabase.from("product_categories").select("*").eq("shop_id", shop.id).order("sort_order");
  return (
    <>
      <PageHeader title="Categories" />
      <InsertForm
        table="product_categories"
        extra={{ shop_id: shop.id }}
        fields={[
          { name: "name", placeholder: "Category", required: true, className: "md:col-span-2" },
          { name: "sort_order", type: "number", placeholder: "Order" },
        ]}
      />
      {!categories?.length ? (
        <div className="mt-4">
          <EmptyState title="No categories" body="Group products and services." />
        </div>
      ) : (
        <ul className="mt-4 grid gap-2">
          {categories.map((row) => (
            <li key={row.id} className="rounded-2xl bg-white p-4">
              {row.name}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
