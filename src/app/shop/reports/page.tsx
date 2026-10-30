import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { getShopDashboardStats } from "@/lib/shop/dashboard-stats";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { ProfitLossPanel } from "@/components/shop/ProfitLossPanel";
import { ManagerReportForm, ManagerReportList } from "@/components/shop/ManagerReports";

export default async function ReportsPage() {
  const { shop } = await getOwnedShop();
  if (!shop) return null;
  const supabase = await createServerSupabase();
  const stats = await getShopDashboardStats(shop.id, { period: "current" });
  const { data: reports } = await supabase
    .from("manager_reports")
    .select("id, title, category, body, status, admin_reply, created_at")
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <>
      <PageHeader title="Reports" subtitle="Figures use the same completed-sales rules as the dashboard. Reports you send stay between this shop and LaGecto admin." />
      {stats ? <div className="mb-8"><ProfitLossPanel stats={stats} /></div> : null}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <ManagerReportForm />
        <div>
          <h2 className="mb-3 font-semibold">Sent to admin</h2>
          {!reports?.length ? (
            <EmptyState title="No reports yet" body="Use this for stock issues, incidents, or operational notes. Other shops cannot see these." />
          ) : (
            <ManagerReportList reports={reports} />
          )}
        </div>
      </div>
    </>
  );
}
