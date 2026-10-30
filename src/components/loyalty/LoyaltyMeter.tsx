import Link from "next/link";

export function LoyaltyMeter({
  levelName,
  points,
  nextName,
  nextPoints,
  unlocked,
  totalBadges,
  rewardsReady,
}: {
  levelName: string;
  points: number;
  nextName?: string | null;
  nextPoints?: number | null;
  unlocked: number;
  totalBadges: number;
  rewardsReady?: number;
}) {
  const target = nextPoints && nextPoints > points ? nextPoints : points || 1;
  const pct = Math.min(100, Math.round((points / target) * 100));
  const remaining = nextPoints != null ? Math.max(0, nextPoints - points) : 0;
  return (
    <section className="lg-card overflow-hidden p-6">
      <p className="os-kicker">Your LaGecto journey</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl font-semibold">Level: {levelName}</h2>
        <p className="text-sm text-[var(--lagecto-muted)]">{points} lifetime points</p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[rgba(18,36,28,0.08)]">
        <span className="block h-full rounded-full bg-[#0B6E4F] transition-[width] duration-700" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-sm text-[var(--lagecto-muted)]">
        {nextName ? (remaining > 0 ? `${remaining} points to ${nextName}` : `You have reached ${nextName}`) : "Highest configured level"}
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <p className="text-sm">
          {unlocked} / {totalBadges} badges
        </p>
        <p className="text-sm">{rewardsReady || 0} rewards available</p>
        <Link href="/customer/loyalty" className="text-sm font-semibold text-[#0B6E4F]">
          View loyalty
        </Link>
      </div>
    </section>
  );
}
