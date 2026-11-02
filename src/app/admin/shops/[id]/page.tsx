import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, StatusBadge } from "@/components/ui/primitives";
import { FeatureAccessPanel } from "@/components/admin/FeatureAccessPanel";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";
import { ShopDeleteControl, ShopMessageButton } from "@/components/admin/ShopManageClient";
import { canDeleteShops, canViewAccountContact, hasAdminLevel, isSuperAdmin } from "@/lib/admin-access";
import { normalizePackageKey } from "@/lib/packages";
import { formatDateTime, money } from "@/lib/format";
import Link from "next/link";

export default async function AdminShopDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole("admin");
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: shop } = await supabase
    .from("shops")
    .select("id, name, login_shop_id, verification_status, owner_email, owner_name, status, category, phone, created_at, slug")
    .eq("id", id)
    .maybeSingle();
  if (!shop) notFound();
  const canMutate = hasAdminLevel(profile, "admin");
  const [{ data: state }, { data: audit }, { data: sub }, { data: orders }, { data: sales }, { count: productCount }, { count: serviceCount }] =
    await Promise.all([
      canMutate ? supabase.rpc("shop_enabled_features", { p_shop_id: shop.id }) : { data: null },
      canMutate
        ? supabase.from("shop_feature_audit").select("id, feature_key, enabled, created_at").eq("shop_id", shop.id).order("created_at", { ascending: false }).limit(12)
        : { data: [] as { id: string; feature_key: string; enabled: boolean; created_at: string }[] },
      supabase.from("subscriptions").select("plan, package_key, status, renewal_date").eq("shop_id", shop.id).in("status", ["active", "trial"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("orders").select("id, order_number, total, status, created_at").eq("shop_id", shop.id).order("created_at", { ascending: false }).limit(6),
      supabase.from("sales").select("id, sale_number, total, status, sale_date").eq("shop_id", shop.id).order("sale_date", { ascending: false }).limit(6),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("type", "product"),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("type", "service"),
    ]);
  const packageKey = normalizePackageKey(state?.package_key || sub?.package_key);
  const enabled = Array.isArray(state?.features) ? state.features.map(String) : [];
  const disabled = Array.isArray(state?.disabled) ? state.disabled.map(String) : [];

  return (
    <>
      <PageHeader
        title={shop.name}
        subtitle={`${shop.login_shop_id || shop.id}${canViewAccountContact(profile) && shop.owner_email ? ` · ${shop.owner_email}` : ""}`}
        action={
          <Link href="/admin/shops" className="rounded-full border px-4 py-2 text-sm">
            All shops
          </Link>
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-3 os-surface">
        <VerifiedBadge verified={shop.verification_status === "verified"} />
        <StatusBadge value={shop.status} />
        <span className="text-sm text-[var(--lagecto-muted)]">Package {sub?.package_key || sub?.plan || packageKey}</span>
        {sub?.renewal_date ? <span className="text-sm text-[var(--lagecto-muted)]">Renews {sub.renewal_date}</span> : null}
        <span className="text-sm text-[var(--lagecto-muted)]">{productCount || 0} products · {serviceCount || 0} services</span>
        {shop.slug ? (
          <Link href={`/s/${shop.slug}`} className="text-sm font-semibold text-[#0B6E4F]">
            Storefront
          </Link>
        ) : null}
        {isSuperAdmin(profile) ? <ShopMessageButton shopId={shop.id} /> : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="os-surface">
          <h2 className="font-semibold">Recent orders</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {(orders || []).map((row) => (
              <li key={row.id} className="flex justify-between gap-3">
                <span>{row.order_number}</span>
                <span>{money(row.total)} · {row.status}</span>
              </li>
            ))}
            {!orders?.length ? <li className="text-[var(--lagecto-muted)]">No marketplace orders yet.</li> : null}
          </ul>
        </section>
        <section className="os-surface">
          <h2 className="font-semibold">Recent sales</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {(sales || []).map((row) => (
              <li key={row.id} className="flex justify-between gap-3">
                <span>{row.sale_number || "Sale"}</span>
                <span>{money(row.total)} · {formatDateTime(row.sale_date)}</span>
              </li>
            ))}
            {!sales?.length ? <li className="text-[var(--lagecto-muted)]">No recorded sales yet.</li> : null}
          </ul>
        </section>
      </div>
      {canMutate ? (
        <>
          <FeatureAccessPanel shopId={shop.id} packageKey={packageKey} enabled={enabled} disabled={disabled} />
          {audit?.length ? (
            <section className="os-surface mt-6">
              <h2 className="font-semibold">Feature history</h2>
              <ul className="mt-3 grid gap-2 text-sm">
                {audit.map((row) => (
                  <li key={row.id}>
                    {row.feature_key} · {row.enabled ? "on" : "off"}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
      {canDeleteShops(profile) ? <ShopDeleteControl shopId={shop.id} shopName={shop.name} /> : null}
    </>
  );
}
