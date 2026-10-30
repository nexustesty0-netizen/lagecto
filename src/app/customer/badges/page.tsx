import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/primitives";
import { evaluateCurrentCustomer, loadCustomerBadges, BADGE_CATEGORIES } from "@/lib/loyalty/load";
import { BadgeCard } from "@/components/loyalty/BadgeCard";
import { AchievementUnlock } from "@/components/loyalty/AchievementUnlock";

export default async function AchievementsPage() {
  const profile = await requireRole("customer");
  const evaluated = await evaluateCurrentCustomer();
  const { defs, earned, progress } = await loadCustomerBadges(profile.id);
  const earnedMap = new Map(earned.map((row) => [row.badge_id, row.earned_at]));
  const progressMap = new Map(progress.map((row) => [row.badge_id, row]));
  const unlocked = earned.length;
  const total = defs.length || 100;
  const recent = [...earned].sort((a, b) => String(b.earned_at).localeCompare(String(a.earned_at))).slice(0, 4);

  return (
    <>
      <AchievementUnlock items={evaluated?.newly_unlocked || []} />
      <PageHeader
        title="Achievements"
        subtitle={`${unlocked} / ${total} unlocked · ${Math.round((unlocked / total) * 100)}% complete. Badges unlock only from confirmed LaGecto activity.`}
      />
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <article className="lg-card p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--lagecto-muted)]">Unlocked</p>
          <p className="mt-2 text-3xl font-semibold text-[#0B6E4F]">{unlocked}</p>
        </article>
        <article className="lg-card p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--lagecto-muted)]">Locked</p>
          <p className="mt-2 text-3xl font-semibold">{total - unlocked}</p>
        </article>
        <article className="lg-card p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--lagecto-muted)]">Recently unlocked</p>
          <p className="mt-2 text-sm">{recent.length ? `${recent.length} this session history` : "None yet"}</p>
        </article>
      </div>
      {BADGE_CATEGORIES.map((category) => {
        const items = defs.filter((def) => def.category === category.slug && def.is_visible);
        if (!items.length) return null;
        return (
          <section key={category.slug} className="mb-10">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">{category.label}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((def) => {
                const got = earnedMap.get(def.id);
                const prog = progressMap.get(def.id);
                return (
                  <BadgeCard
                    key={def.id}
                    name={def.name}
                    description={def.description}
                    rarity={def.rarity}
                    icon={def.icon}
                    unlocked={Boolean(got)}
                    progress={Number(prog?.current_value || 0)}
                    target={Number(prog?.target_value || def.requirements?.all?.[0]?.gte || 1)}
                    earnedAt={got || null}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}
