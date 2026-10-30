import { featureLockReason, getCurrentPeriod, loadOwnedShopWithFeatures } from "@/lib/entitlements";
import { getShopDashboardStats } from "@/lib/shop/dashboard-stats";
import { PageHeader, StatCard } from "@/components/ui/primitives";
import { FeatureLocked } from "@/components/shop/FeatureLocked";
import { money } from "@/lib/format";

export default async function InsightsPage() {
  const { shop, features, disabledFeatures } = await loadOwnedShopWithFeatures();
  if (!shop) return null;
  const locked = featureLockReason(features, disabledFeatures, "analytics");
  if (locked) return <FeatureLocked feature="analytics" reason={locked} />;
  const period = await getCurrentPeriod(shop.id);
  const stats = await getShopDashboardStats(shop.id, { period: "current" });
  return (
    <>
      <PageHeader title="Business intelligence" subtitle={period?.label || "No current period"} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" value={money(stats?.revenue || 0)} hint="Same source as the shop dashboard" />
        <StatCard label="Payroll" value={money(stats?.payroll || 0)} />
        <StatCard label="Expenses" value={money(stats?.expenses || 0)} />
        <StatCard label="Operating result" value={money(stats?.profit || 0)} hint={stats?.calculation_label} />
      </div>
    </>
  );
}
