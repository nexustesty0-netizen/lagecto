import { requireRole } from "@/lib/auth/session";
import { PageHeader, EmptyState, StatCard } from "@/components/ui/primitives";
import { evaluateCurrentCustomer, loadCustomerLoyalty, loadCustomerBadges, loadCustomerRewards, asOne } from "@/lib/loyalty/load";
import { LoyaltyMeter } from "@/components/loyalty/LoyaltyMeter";
import { AchievementUnlock } from "@/components/loyalty/AchievementUnlock";
import Link from "next/link";

export default async function LoyaltyPage() {
  const profile = await requireRole("customer");
  const evaluated = await evaluateCurrentCustomer();
  const [{ platformWallet, shopWallets, levels, transactions }, badges, rewards] = await Promise.all([
    loadCustomerLoyalty(profile.id),
    loadCustomerBadges(profile.id),
    loadCustomerRewards(profile.id),
  ]);
  const level = asOne(platformWallet?.loyalty_levels as { name?: string; rank?: number; min_points?: number } | { name?: string; rank?: number; min_points?: number }[] | null);
  const currentRank = Number(level?.rank || 1);
  const next = levels.find((row) => row.rank === currentRank + 1);
  const points = Number(platformWallet?.lifetime_points || 0);
  const earnedCount = badges.earned.length;
  const availableRewards = rewards.rewards.length - rewards.claims.filter((row) => row.status === "claimed" || row.status === "used").length;
  const snap = evaluated?.snapshot || {};
  const orders = Number(snap.completed_orders || 0);
  const reviews = Number(snap.reviews_count || 0);

  return (
    <>
      <AchievementUnlock items={evaluated?.newly_unlocked || []} />
      <PageHeader
        title="Loyalty"
        subtitle="LaGecto rewards and each shop’s rewards stay in separate balances. Points are awarded only after the server confirms a real action."
      />
      <LoyaltyMeter
        levelName={level?.name || "Newcomer"}
        points={points}
        nextName={next?.name}
        nextPoints={next?.min_points}
        unlocked={earnedCount}
        totalBadges={badges.defs.length || 100}
        rewardsReady={Math.max(availableRewards, 0)}
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Platform points" value={String(platformWallet?.points || 0)} hint="LaGecto-wide balance" />
        <StatCard label="Shop wallets" value={String(shopWallets.length)} hint="Separate from platform points" />
        <StatCard label="Completed orders" value={String(orders)} hint="Refunded orders are not counted" />
      </div>
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="lg-card p-5">
          <p className="os-kicker">Next steps</p>
          <ul className="mt-3 grid gap-2 text-sm">
            <li>{orders < 1 ? "Complete your first order to unlock First Order." : `You have ${orders} valid orders.`}</li>
            <li>{reviews < 1 ? "Leave a review to unlock your next reward." : `${reviews} reviews recorded.`}</li>
            {next ? <li>You are {Math.max(0, next.min_points - points)} points from {next.name}.</li> : <li>You are on the highest configured level.</li>}
          </ul>
          <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-[#0B6E4F]">
            <Link href="/customer/badges">Achievements</Link>
            <Link href="/customer/rewards">My rewards</Link>
            <Link href="/customer/promotions">Promotions</Link>
          </div>
        </section>
        <section className="lg-card p-5">
          <p className="os-kicker">Recent activity</p>
          {!transactions.length ? (
            <p className="mt-3 text-sm text-[var(--lagecto-muted)]">Points appear after completed orders, reviews, and challenges.</p>
          ) : (
            <ul className="mt-3 grid gap-2 text-sm">
              {transactions.map((row) => (
                <li key={row.id} className="flex justify-between gap-3">
                  <span>{row.reason || row.kind}</span>
                  <span className={row.points < 0 ? "text-red-700" : "text-[#0B6E4F]"}>
                    {row.points > 0 ? "+" : ""}
                    {row.points}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Shop loyalty</h2>
        {!shopWallets.length ? (
          <EmptyState title="No shop wallets yet" body="Each shop keeps its own points. They appear after a completed purchase at that shop." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {shopWallets.map((wallet) => {
              const shop = asOne(wallet.shops as { name?: string; slug?: string } | { name?: string; slug?: string }[] | null);
              const lvl = asOne(wallet.loyalty_levels as { name?: string } | { name?: string }[] | null);
              return (
                <article key={wallet.id} className="lg-card p-5">
                  <p className="text-sm text-[var(--lagecto-muted)]">{shop?.name || "Shop"}</p>
                  <p className="text-2xl font-semibold text-[#0B6E4F]">{wallet.points} pts</p>
                  <p className="mt-1 text-sm">{lvl?.name || "Member"} · {wallet.lifetime_points} lifetime</p>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <p className="mt-6 text-xs text-[var(--lagecto-muted)]">Displayed totals are a view of server balances. They cannot be edited from this page.</p>
    </>
  );
}
