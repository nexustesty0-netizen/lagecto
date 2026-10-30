export function VerifiedBadge({
  verified,
  className = "",
}: {
  verified?: boolean | null;
  className?: string;
}) {
  if (!verified) return null;
  return (
    <span
      className={`inline-flex h-[18px] w-[18px] shrink-0 align-middle ${className}`}
      title="Verified shop"
      aria-label="Verified shop"
    >
      <svg viewBox="0 0 20 20" className="h-full w-full" aria-hidden>
        <circle cx="10" cy="10" r="10" fill="#0B6E4F" />
        <circle cx="10" cy="10" r="8.15" fill="none" stroke="#D4AF37" strokeWidth="1.6" />
        <path
          d="M5.6 10.35 8.35 13.2l5.95-7.05"
          fill="none"
          stroke="#D4AF37"
          strokeWidth="2.15"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
