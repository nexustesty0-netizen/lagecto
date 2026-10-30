import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, StatCard, EmptyState, ActionTile } from "@/components/ui/primitives";
import { ShopCover, SHOP_GRID_CLASS } from "@/components/public/ShopCard";
import { categoryLabel } from "@/lib/brand";
import { evaluateCurrentCustomer, loadCustomerLoyalty, loadCustomerBadges, loadCustomerRewards, asOne } from "@/lib/loyalty/load";
import { LoyaltyMeter } from "@/components/loyalty/LoyaltyMeter";
import { AchievementUnlock } from "@/components/loyalty/AchievementUnlock";

export default async function CustomerDashboard() {
  const profile = await requireRole("customer");
  const supabase = await createServerSupabase();
  const [{ count: orderCount }, { count: receiptCount }, { data: shops }, evaluated, loyalty, badges, rewards] = await Promise.all([
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("customer_id", profile.id),
    supabase.from("receipts").select("*", { count: "exact", head: true }).eq("customer_id", profile.id),
    supabase.from("shops").select("id, name, category, avg_rating, logo_url, banner_url, slug").eq("status", "active").limit(6),
    evaluateCurrentCustomer(),
    loadCustomerLoyalty(profile.id),
    loadCustomerBadges(profile.id),
    loadCustomerRewards(profile.id),
  ]);
  const level = asOne(loyalty.platformWallet?.loyalty_levels as { name?: string; rank?: number } | { name?: string; rank?: number }[] | null);
  const next = loyalty.levels.find((row) => row.rank === Number(level?.rank || 1) + 1);

  return (
    <>
      <PageHeader
        title={`Hello${profile.name ? `, ${profile.name}` : ""}`}
        subtitle="A calmer way to shop local businesses, keep receipts, and follow orders."
      />
      <AchievementUnlock items={evaluated?.newly_unlocked || []} />
      <div className="mb-8">
        <LoyaltyMeter
          levelName={level?.name || "Newcomer"}
          points={Number(loyalty.platformWallet?.lifetime_points || 0)}
          nextName={next?.name}
          nextPoints={next?.min_points}
          unlocked={badges.earned.length}
          totalBadges={badges.defs.length || 100}
          rewardsReady={Math.max(rewards.rewards.length - rewards.claims.length, 0)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Orders" value={String(orderCount || 0)} />
        <StatCard label="Receipts" value={String(receiptCount || 0)} />
        <StatCard label="Open shops" value={String(shops?.length || 0)} hint="A sample of active shops" />
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ActionTile href="/customer/shops" title="Browse shops" hint="Find something nearby" />
        <ActionTile href="/customer/orders" title="View orders" hint="Track what you placed" />
        <ActionTile href="/customer/diary" title="Diary" hint="Keep your private notes" />
        <ActionTile href="/customer/loyalty" title="Loyalty" hint="Levels, rewards and badges" />
        <ActionTile href="/customer/stebo" title="Stebo" hint="Ask for shopping help" />
      </div>
      <article className="lg-card mt-8 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">Need help?</p>
        <h2 className="mt-1 text-xl font-semibold">We&apos;re here for you.</h2>
        <p className="mt-2 text-sm text-[var(--lagecto-muted)]">Find answers, report a problem, or talk to LaGecto Support.</p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-[#0B6E4F]">
          <Link href="/support">Help & Support</Link>
          <Link href="/support/faqs">FAQs</Link>
          <Link href="/support/contact">Contact Support</Link>
          <Link href="/support/bug">Report a problem</Link>
        </div>
      </article>
      <div className="mt-10">
        <h2 className="mb-4 text-lg font-semibold">Explore shops</h2>
        {!shops?.length ? (
          <EmptyState title="No shops yet" body="Active shops will appear here after they are published." />
        ) : (
          <div className={SHOP_GRID_CLASS}>
            {shops.map((shop) => (
              <Link key={shop.id} href={shop.slug ? `/s/${shop.slug}` : `/customer/shops/${shop.id}`} className="group lg-card overflow-hidden p-0 transition hover:-translate-y-0.5">
                <ShopCover name={shop.name} bannerUrl={shop.banner_url} logoUrl={shop.logo_url} category={shop.category} className="aspect-[4/3]" />
                <div className="p-2.5 sm:p-4">
                  <p className="line-clamp-2 text-sm font-semibold leading-tight sm:text-base">{shop.name}</p>
                  <p className="mt-0.5 text-xs text-[var(--lagecto-muted)] sm:text-sm">{categoryLabel(shop.category)}</p>
                  <p className="mt-1 text-xs text-[#D4AF37] sm:mt-2 sm:text-sm">{Number(shop.avg_rating || 0).toFixed(1)} rating</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
