import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/primitives";
import { FeatureAccessPanel } from "@/components/admin/FeatureAccessPanel";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";
import { normalizePackageKey } from "@/lib/packages";
import Link from "next/link";

export default async function AdminShopDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: shop } = await supabase
    .from("shops")
    .select("id, name, login_shop_id, verification_status, owner_email, status")
    .eq("id", id)
    .maybeSingle();
  if (!shop) notFound();
  const { data: state } = await supabase.rpc("shop_enabled_features", { p_shop_id: shop.id });
  const packageKey = normalizePackageKey(state?.package_key);
  const enabled = Array.isArray(state?.features) ? state.features.map(String) : [];
  const disabled = Array.isArray(state?.disabled) ? state.disabled.map(String) : [];
  const { data: audit } = await supabase
    .from("shop_feature_audit")
    .select("id, feature_key, enabled, created_at")
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false })
    .limit(12);

  return (
    <>
      <PageHeader
        title={shop.name}
        subtitle={`${shop.login_shop_id || shop.id} · ${shop.owner_email}`}
        action={
          <Link href="/admin/shops" className="rounded-full border px-4 py-2 text-sm">
            All shops
          </Link>
        }
      />
      <div className="mb-6 os-surface">
        <div className="flex flex-wrap items-center gap-2">
          <VerifiedBadge verified={shop.verification_status === "verified"} />
          <span className="text-sm text-[var(--lagecto-muted)]">Status {shop.status}</span>
          <span className="text-sm text-[var(--lagecto-muted)]">Package {packageKey}</span>
        </div>
      </div>
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
  );
}
