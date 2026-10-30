import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { InsertForm } from "@/components/forms/InsertForm";

export default async function SuppliersPage() {
  const { shop } = await getOwnedShop();
  if (!shop) return null;
  const supabase = await createServerSupabase();
  const { data: suppliers } = await supabase.from("suppliers").select("*").eq("shop_id", shop.id).order("name");
  return (
    <>
      <PageHeader title="Suppliers" />
      <InsertForm
        table="suppliers"
        extra={{ shop_id: shop.id }}
        fields={[
          { name: "name", placeholder: "Name", required: true },
          { name: "phone", placeholder: "Phone" },
          { name: "email", placeholder: "Email" },
          { name: "address", placeholder: "Address" },
        ]}
      />
      {!suppliers?.length ? (
        <div className="mt-4">
          <EmptyState title="No suppliers" body="Add suppliers before recording purchases." />
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {suppliers.map((row) => (
            <article key={row.id} className="rounded-2xl bg-white p-4">
              <p className="font-semibold">{row.name}</p>
              <p className="text-sm text-[#6B7280]">{row.phone} · {row.email}</p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
