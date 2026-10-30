import { rarityClass } from "@/lib/loyalty/load";

export function BadgeCard({
  name,
  description,
  rarity,
  icon,
  unlocked,
  progress,
  target,
  earnedAt,
}: {
  name: string;
  description?: string | null;
  rarity: string;
  icon?: string;
  unlocked: boolean;
  progress?: number;
  target?: number;
  earnedAt?: string | null;
}) {
  const pct = target && target > 0 ? Math.min(100, Math.round(((progress || 0) / target) * 100)) : unlocked ? 100 : 0;
  return (
    <article
      className={`lg-badge-card ${unlocked ? "is-unlocked" : "is-locked"} ${rarityClass(rarity)}`}
      aria-label={`${name}, ${unlocked ? "unlocked" : "locked"}, ${rarity}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="lg-badge-mark" aria-hidden>
          {unlocked ? "◆" : "◇"}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">{rarity}</span>
      </div>
      <p className="mt-3 font-semibold">{name}</p>
      <p className="mt-1 text-sm text-[var(--lagecto-muted)]">{description}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[rgba(18,36,28,0.08)]" aria-hidden={!unlocked}>
        <span className="block h-full rounded-full bg-[#0B6E4F] transition-[width] duration-700" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-[var(--lagecto-muted)]">
        {unlocked
          ? earnedAt
            ? `Unlocked ${new Date(earnedAt).toLocaleDateString()}`
            : "Unlocked"
          : target
            ? `${Math.min(progress || 0, target)} / ${target}`
            : "In progress"}
      </p>
      <span className="sr-only">{icon}</span>
    </article>
  );
}

export function ShopBadgePills({
  badges,
  tone = "onLight",
}: {
  badges?: { slug: string; name: string }[] | null;
  tone?: "onLight" | "onDark";
}) {
  if (!badges?.length) return null;
  const pill =
    tone === "onDark"
      ? "rounded-full bg-white/18 px-2 py-0.5 text-[11px] font-semibold text-white"
      : "rounded-full bg-[#0B6E4F]/10 px-2 py-0.5 text-[11px] font-semibold text-[#0B6E4F]";
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Shop achievements">
      {badges.slice(0, 3).map((badge) => (
        <li key={badge.slug} className={pill}>
          {badge.slug === "verified_shop" ? "Verified" : badge.name}
        </li>
      ))}
    </ul>
  );
}
