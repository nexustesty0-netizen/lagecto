import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { AdminProductsTable } from "@/components/admin/AdminProductsTable";

export default async function AdminProductsPage() {
  await requireRole("admin");
  const supabase = await createServerSupabase();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, stock, type, category, shops(name)")
    .eq("is_available", true)
    .order("name")
    .limit(300);

  return (
    <>
      <PageHeader title="Products" subtitle="Listed catalogue items across shops. This is a read-only overview — shops still own their own catalogues." />
      {!products?.length ? (
        <EmptyState title="No listed products" body="Items appear here when shops mark them available." />
      ) : (
        <AdminProductsTable
          products={products.map((product) => ({
            ...product,
            shops: Array.isArray(product.shops) ? product.shops[0] || null : product.shops,
          }))}
        />
      )}
    </>
  );
}
