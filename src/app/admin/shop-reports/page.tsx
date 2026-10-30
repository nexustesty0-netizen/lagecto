import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { ManagerReportList, AdminReportActions } from "@/components/shop/ManagerReports";

export default async function AdminShopReportsPage() {
  await requireRole("admin");
  const supabase = await createServerSupabase();
  const { data: reports } = await supabase
    .from("manager_reports")
    .select("id, title, category, body, status, admin_reply, created_at, shop_id, shops(name)")
    .order("created_at", { ascending: false })
    .limit(80);

  return (
    <>
      <PageHeader title="Shop reports" subtitle="Operational notes from shop owners. These are not public and are not mixed with other shops." />
      {!reports?.length ? (
        <EmptyState title="No reports" body="When a shop owner sends an update, it appears here." />
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => (
            <div key={report.id}>
              <ManagerReportList reports={[report]} />
              <AdminReportActions id={report.id} status={report.status} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
