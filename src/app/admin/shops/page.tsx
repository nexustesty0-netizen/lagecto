import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { ShopManageClient } from "@/components/admin/ShopManageClient";
import { SelfServeShopToggle } from "@/components/admin/SelfServeShopToggle";
import { selfServeShopCreationEnabled } from "@/lib/platform-flags.server";
import Link from "next/link";

export default async function AdminShopsPage() {
  await requireRole("admin");
  const supabase = await createServerSupabase();
  const [{ data: shops }, { data: plans }, selfServe] = await Promise.all([
    supabase
      .from("shops")
      .select("id, name, login_shop_id, owner_name, owner_email, status, verification_status, category, provider_type, phone, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("subscription_plans").select("id, name, package_key, duration_key, duration_months, price").eq("is_active", true).order("price"),
    selfServeShopCreationEnabled(),
  ]);

  return (
    <>
      <PageHeader
        title="Shops"
        subtitle="Public shop creation can be turned off below. You can still create a shop from Manage users. Assigning a paid package verifies the shop."
        action={
          <Link href="/admin/users" className="rounded-full border px-4 py-2 text-sm">
            Manage users
          </Link>
        }
      />
      <div className="mb-6">
        <SelfServeShopToggle enabled={selfServe} />
      </div>
      {!shops?.length ? (
        <EmptyState title="No shops" body="Open Manage users, assign someone as a shop owner, then return here to set their package." />
      ) : (
        <ShopManageClient shops={shops} plans={plans || []} />
      )}
    </>
  );
}
