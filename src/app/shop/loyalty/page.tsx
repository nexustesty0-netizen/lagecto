import { getOwnedShop } from "@/lib/auth/session";
import { PageHeader, StatCard, EmptyState } from "@/components/ui/primitives";
import { createServerSupabase } from "@/lib/supabase/server";
import { PromoCodeAdminForm } from "@/components/loyalty/PromoCodeForm";
import { ShopRewardForm } from "@/components/shop/ShopRewardForm";
import { ShopBadgePills } from "@/components/loyalty/BadgeCard";
import { loadShopBadgesMap } from "@/lib/loyalty/load";

export default async function ShopLoyaltyPage() {
  const { shop } = await getOwnedShop();
  if (!shop) return null;
  const supabase = await createServerSupabase();
  await supabase.rpc("evaluate_shop_achievements", { p_shop_id: shop.id });
  const [{ data: stats }, { data: codes }, { data: program }, badgeMap] = await Promise.all([
    supabase.rpc("loyalty_analytics_shop", { p_shop_id: shop.id }),
    supabase.from("promo_codes").select("*").eq("shop_id", shop.id).order("created_at", { ascending: false }),
    supabase.from("loyalty_programs").select("id").eq("shop_id", shop.id).maybeSingle(),
    loadShopBadgesMap([shop.id]),
  ]);
  const { data: levels } = program
    ? await supabase.from("loyalty_levels").select("id, name").eq("program_id", program.id).eq("is_active", true).order("rank")
    : { data: [] as { id: string; name: string }[] };
  const { data: rewards } = await supabase.from("rewards").select("id, name, reward_type, value, is_active").eq("shop_id", shop.id).order("created_at", { ascending: false });
  const top = (stats?.top_customers || []) as { display_name?: string; lifetime_points?: number }[];

  return (
    <>
      <PageHeader title="Customer loyalty" subtitle="Only customers of this shop. You cannot see or change another shop’s loyalty, or LaGecto platform rewards." />
      <ShopBadgePills badges={badgeMap.get(shop.id)} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Loyal customers" value={String(stats?.loyal_customers || 0)} />
        <StatCard label="Returning customers" value={String(stats?.returning_customers || 0)} />
        <StatCard label="Rewards issued" value={String(stats?.rewards_issued || 0)} hint={`${stats?.rewards_redeemed || 0} redeemed`} />
        <StatCard label="Active codes" value={String(stats?.active_promos || 0)} />
      </div>
      <section className="mt-8 lg-card p-5">
        <h2 className="font-semibold">Top loyal customers</h2>
        {!top.length ? (
          <p className="mt-2 text-sm text-[var(--lagecto-muted)]">Names only — no emails or phones are shown here.</p>
        ) : (
          <ul className="mt-3 grid gap-2 text-sm">
            {top.map((row, index) => (
              <li key={`${row.display_name}-${index}`} className="flex justify-between">
                <span>{row.display_name}</span>
                <span>{row.lifetime_points} pts</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Shop rewards</h2>
        <ShopRewardForm />
        {!rewards?.length ? (
          <EmptyState title="No shop rewards" body="Create a milestone reward for customers who complete purchases here." />
        ) : (
          <ul className="mt-3 grid gap-2">
            {rewards.map((reward) => (
              <li key={reward.id} className="rounded-2xl bg-white p-4">
                {reward.name} · {reward.reward_type.replaceAll("_", " ")} · {reward.is_active ? "active" : "off"}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Shop promo codes</h2>
        <PromoCodeAdminForm codes={codes || []} levels={levels || []} scope="shop" />
      </section>
    </>
  );
}
