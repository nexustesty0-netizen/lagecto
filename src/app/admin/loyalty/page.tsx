import { requireAdminLevel } from "@/lib/auth/session";
import { PageHeader, StatCard, ActionTile } from "@/components/ui/primitives";
import { createServerSupabase } from "@/lib/supabase/server";
import Link from "next/link";
import { AdminLoyaltyEditors } from "@/components/admin/AdminLoyaltyEditors";
import { asOne } from "@/lib/loyalty/load";

export default async function AdminLoyaltyPage() {
  await requireAdminLevel("admin");
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("loyalty_analytics_admin");
  const stats = data || {};
  const [{ data: members }, { data: campaigns }, { data: codes }] = await Promise.all([
    supabase
      .from("loyalty_wallets")
      .select("id, points, lifetime_points, user_id, users(name)")
      .eq("scope", "platform")
      .gt("lifetime_points", 0)
      .order("lifetime_points", { ascending: false })
      .limit(20),
    supabase.from("campaigns").select("id, name, kind, is_active, ends_at, enrollment_count").order("created_at", { ascending: false }).limit(8),
    supabase.from("promo_codes").select("id, code, name, is_active, usage_count, ends_at, owner_scope").eq("owner_scope", "platform").order("created_at", { ascending: false }).limit(12),
  ]);

  return (
    <div className="admin-console">
      <PageHeader title="Customer loyalty" subtitle="LaGecto-wide programme. Shop loyalty is managed by each shop and is not mixed into these totals." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active members" value={String(stats.members || 0)} />
        <StatCard label="Rewards claimed" value={String(stats.rewards_claimed || 0)} hint={`${stats.rewards_used || 0} redeemed`} />
        <StatCard label="Promo redemptions" value={String(stats.promo_redemptions || 0)} />
        <StatCard label="Badge unlocks" value={String(stats.badge_unlocks || 0)} />
        <StatCard label="Founding users" value={String(stats.founding_users || 0)} hint={`${stats.founding_shops || 0} shops`} />
        <StatCard label="Active campaigns" value={String(stats.active_campaigns || 0)} />
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ActionTile href="/admin/badges" title="Badges" hint="Edit 100 customer badges and shop badges" />
        <ActionTile href="/admin/campaigns" title="Campaigns" hint="Founding Users and loyalty campaigns" />
        <ActionTile href="/admin/promo-codes" title="Promo codes" hint="Platform-wide codes" />
        <ActionTile href="/admin/news" title="News" hint="Publish loyalty stories" />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="lg-card p-5">
          <h2 className="font-semibold">Participating customers</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {(members || []).map((row) => {
              const user = asOne(row.users as { name?: string } | { name?: string }[] | null);
              return (
                <li key={row.id} className="flex justify-between gap-3">
                  <span>{user?.name || "Customer"}</span>
                  <span>{row.lifetime_points} pts</span>
                </li>
              );
            })}
            {!members?.length ? <li className="text-[var(--lagecto-muted)]">No platform points awarded yet.</li> : null}
          </ul>
        </section>
        <section className="lg-card p-5">
          <h2 className="font-semibold">Platform codes</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {(codes || []).map((row) => (
              <li key={row.id} className="flex justify-between gap-3">
                <span>{row.code}</span>
                <span>{row.usage_count} uses · {row.is_active ? "active" : "off"}</span>
              </li>
            ))}
          </ul>
          <Link href="/admin/promo-codes" className="mt-3 inline-block text-sm font-semibold text-[#0B6E4F]">
            Manage codes
          </Link>
        </section>
      </div>
      <section className="mt-6 lg-card p-5">
        <h2 className="font-semibold">Campaigns</h2>
        <ul className="mt-3 grid gap-2 text-sm">
          {(campaigns || []).map((row) => (
            <li key={row.id}>
              {row.name} · {row.kind} · {row.enrollment_count} enrolled · {row.is_active ? "active" : "inactive"}
            </li>
          ))}
        </ul>
      </section>
      <AdminLoyaltyEditors />
    </div>
  );
}
