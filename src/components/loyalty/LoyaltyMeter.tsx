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
    <section className="overflow-hidden rounded-[var(--lg-radius)] border border-[var(--lagecto-border)] bg-white">
      <div className="h-1.5 bg-[#D4AF37]" />
      <div className="p-4 sm:p-6">
        <p className="os-kicker">Your LaGecto journey</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-semibold sm:text-2xl">Level: {levelName}</h2>
          <p className="text-sm text-[var(--lagecto-muted)]">{points} lifetime points</p>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[rgba(18,36,28,0.08)]">
          <span className="block h-full rounded-full bg-[#0B6E4F] transition-[width] duration-700" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-sm text-[var(--lagecto-muted)]">
          {nextName ? (remaining > 0 ? `${remaining} points to ${nextName}` : `You have reached ${nextName}`) : "Highest configured level"}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center sm:mt-5 sm:text-left">
          <p className="rounded-2xl bg-[#E8F4EE] px-2 py-2 text-[11px] sm:text-sm">
            {unlocked} / {totalBadges} badges
          </p>
          <p className="rounded-2xl bg-[#F8F1D8] px-2 py-2 text-[11px] sm:text-sm">{rewardsReady || 0} rewards</p>
          <Link href="/customer/loyalty" className="rounded-2xl bg-[#0B6E4F] px-2 py-2 text-[11px] font-semibold text-white sm:text-sm">
            View loyalty
          </Link>
        </div>
      </div>
    </section>
  );
}
