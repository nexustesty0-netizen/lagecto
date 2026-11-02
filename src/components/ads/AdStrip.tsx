import { getDisplayAds } from "@/lib/ads";
import { AdRail } from "@/components/ads/AdRail";

export async function AdStrip({
  limit = 4,
  compact = false,
  className = "",
}: {
  limit?: number;
  compact?: boolean;
  className?: string;
}) {
  const ads = await getDisplayAds(limit);
  if (!ads.length) return null;
  return (
    <section className={className}>
      <AdRail ads={ads} compact={compact} />
    </section>
  );
}
