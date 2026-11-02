import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { ShopManageClient } from "@/components/admin/ShopManageClient";
import { SelfServeShopToggle } from "@/components/admin/SelfServeShopToggle";
import { selfServeShopPortal } from "@/lib/platform-flags.server";
import {
  canAssignShopPlans,
  canDeleteShops,
  canManagePlatformSettings,
  canRegenerateShopId,
  canViewAccountContact,
  hasAdminLevel,
  isSuperAdmin,
} from "@/lib/admin-access";
import { packageKeyOf } from "@/lib/admin/control-centre";
import Link from "next/link";

export default async function AdminShopsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const profile = await requireRole("admin");
  const { q } = await searchParams;
  const supabase = await createServerSupabase();
  const [{ data: shops }, { data: plans }, { data: subs }, selfServe] = await Promise.all([
    supabase
      .from("shops")
      .select("id, name, login_shop_id, owner_name, owner_email, status, verification_status, category, provider_type, phone, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("subscription_plans").select("id, name, package_key, duration_key, duration_months, price").eq("is_active", true).order("price"),
    supabase.from("subscriptions").select("shop_id, package_key, plan, status").in("status", ["active", "trial"]),
    selfServeShopPortal(),
  ]);
  const packageByShop = new Map<string, string>();
  for (const row of subs || []) {
    if (!row.shop_id || packageByShop.has(row.shop_id)) continue;
    const key = packageKeyOf(row.package_key || row.plan);
    packageByShop.set(row.shop_id, key === "other" ? String(row.plan || "package") : key);
  }
  const rows = (shops || []).map((shop) => ({ ...shop, package_label: packageByShop.get(shop.id) || null }));

  return (
    <>
      <PageHeader
        title="Shops"
        subtitle="Search, verify, suspend, and open a shop. Sensitive changes are written to the audit log."
        action={
          <Link href="/admin/verification" className="rounded-full border px-4 py-2 text-sm">
            Verification queue
          </Link>
        }
      />
      {canManagePlatformSettings(profile) ? (
        <div className="mb-6">
          <SelfServeShopToggle enabled={selfServe.open} used={selfServe.used} limit={selfServe.limit} />
        </div>
      ) : null}
      {!rows.length ? (
        <EmptyState title="No shops" body="Open Admin users, assign someone as a shop owner, then return here to set their package." />
      ) : (
        <ShopManageClient
          shops={rows}
          plans={plans || []}
          initialQuery={q || ""}
          canRegenerate={canRegenerateShopId(profile)}
          canAssignPlan={canAssignShopPlans(profile)}
          canDelete={canDeleteShops(profile)}
          canMutate={hasAdminLevel(profile, "admin")}
          canSeeContact={canViewAccountContact(profile)}
          canMessage={isSuperAdmin(profile)}
        />
      )}
    </>
  );
}
