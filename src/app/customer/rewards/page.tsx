import { requireRole } from "@/lib/auth/session";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui/primitives";
import { evaluateCurrentCustomer, loadCustomerRewards, asOne } from "@/lib/loyalty/load";
import { AchievementUnlock } from "@/components/loyalty/AchievementUnlock";
import { ClaimRewardButton } from "@/components/loyalty/ClaimRewardButton";
import { money, formatDate } from "@/lib/format";

export default async function RewardsPage() {
  const profile = await requireRole("customer");
  const evaluated = await evaluateCurrentCustomer();
  const { rewards, claims, redemptions } = await loadCustomerRewards(profile.id);
  const claimedIds = new Set(claims.map((row) => row.reward_id));
  const savings = redemptions.reduce((sum, row) => sum + Number(row.discount_amount || 0), 0);

  return (
    <>
      <AchievementUnlock items={evaluated?.newly_unlocked || []} />
      <PageHeader title="My rewards" subtitle="Claimed codes are generated on the server. Discount values cannot be changed from this page." />
      <p className="mb-6 text-sm text-[var(--lagecto-muted)]">Savings recorded from valid promo redemptions: {money(savings)}</p>
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Available</h2>
        {!rewards.length ? (
          <EmptyState title="No rewards yet" body="Admins and shops publish rewards here. Requirements are checked when you claim." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {rewards.map((reward) => (
              <article key={reward.id} className="lg-card p-5">
                <p className="font-semibold">{reward.name}</p>
                <p className="mt-1 text-sm text-[var(--lagecto-muted)]">{reward.description}</p>
                <p className="mt-2 text-sm">
                  {reward.reward_type.replaceAll("_", " ")}
                  {Number(reward.value) ? ` · ${reward.reward_type.includes("percent") ? `${reward.value}%` : money(reward.value)}` : ""}
                </p>
                {claimedIds.has(reward.id) ? (
                  <p className="mt-3 text-sm text-[#0B6E4F]">Already claimed</p>
                ) : (
                  <ClaimRewardButton rewardId={reward.id} />
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Claimed and used</h2>
        {!claims.length ? (
          <p className="text-sm text-[var(--lagecto-muted)]">Nothing claimed yet.</p>
        ) : (
          <div className="grid gap-3">
            {claims.map((claim) => {
              const reward = asOne(claim.rewards as { name?: string } | { name?: string }[] | null);
              const code = asOne(claim.promo_codes as { code?: string; ends_at?: string } | { code?: string; ends_at?: string }[] | null);
              return (
                <article key={claim.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4">
                  <div>
                    <p className="font-semibold">{reward?.name || "Reward"}</p>
                    {code?.code ? <p className="text-sm text-[#0B6E4F]">Code {code.code}</p> : null}
                    <p className="text-xs text-[var(--lagecto-muted)]">{formatDate(claim.created_at)}</p>
                  </div>
                  <StatusBadge value={claim.status} />
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
