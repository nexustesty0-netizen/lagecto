import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { categoryCounts } from "@/lib/admin/control-centre";
import { categoryLabel } from "@/lib/brand";

export default async function AdminCategoriesPage() {
  await requireRole("admin");
  const supabase = await createServerSupabase();
  const [{ data: shops }, { data: products }] = await Promise.all([
    supabase.from("shops").select("category"),
    supabase.from("products").select("category").eq("is_available", true).limit(1000),
  ]);
  const shopCats = categoryCounts(shops || []).map((row) => ({
    ...row,
    label: row.key === "uncategorised" ? "Uncategorised" : categoryLabel(row.key),
  }));
  const productCats = categoryCounts(products || []);

  return (
    <>
      <PageHeader title="Categories" subtitle="Counts from existing shops and listed products. This does not create a new catalogue." />
      {!shopCats.length && !productCats.length ? (
        <EmptyState title="No categories yet" body="Shop and product categories appear after shops add them." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="os-surface">
            <h2 className="font-semibold">Shop categories</h2>
            <ul className="mt-3 grid gap-2 text-sm">
              {shopCats.map((row) => (
                <li key={row.key} className="flex justify-between rounded-xl bg-[#F7F3E8] px-3 py-2">
                  <span className="capitalize">{row.label}</span>
                  <span>{row.count}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="os-surface">
            <h2 className="font-semibold">Product categories</h2>
            <ul className="mt-3 grid gap-2 text-sm">
              {productCats.map((row) => (
                <li key={row.key} className="flex justify-between rounded-xl bg-[#F7F3E8] px-3 py-2">
                  <span className="capitalize">{row.label}</span>
                  <span>{row.count}</span>
                </li>
              ))}
              {!productCats.length ? <li className="text-[var(--lagecto-muted)]">No listed products yet.</li> : null}
            </ul>
          </section>
        </div>
      )}
    </>
  );
}
