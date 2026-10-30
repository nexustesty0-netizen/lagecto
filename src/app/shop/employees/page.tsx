import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { featureLockReason, loadOwnedShopWithFeatures } from "@/lib/entitlements";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { FeatureLocked } from "@/components/shop/FeatureLocked";
import { EmployeeBoard } from "@/components/shop/EmployeeBoard";

export default async function EmployeesPage() {
  const { shop, features, disabledFeatures } = await loadOwnedShopWithFeatures();
  if (!shop) return null;
  const locked = featureLockReason(features, disabledFeatures, "employees");
  if (locked) return <FeatureLocked feature="employees" reason={locked} />;
  const supabase = await createServerSupabase();
  const [{ data: employees }, { data: payroll }] = await Promise.all([
    supabase.from("employees").select("*").eq("shop_id", shop.id).order("name"),
    supabase.from("payroll_records").select("employee_id, status, created_at").eq("shop_id", shop.id).order("created_at", { ascending: false }),
  ]);
  const latest = new Map<string, string>();
  for (const row of payroll || []) {
    if (row.employee_id && !latest.has(row.employee_id)) latest.set(row.employee_id, row.status);
  }
  const cards = (employees || []).map((row) => ({
    ...row,
    latest_payroll_status: latest.get(row.id) || null,
  }));

  return (
    <>
      <PageHeader
        title="People"
        subtitle="Staff for this shop only. Payroll history stays if someone is deactivated."
        action={
          <Link href="/shop/employees/new" className="rounded-full bg-[#0B6E4F] px-4 py-2 text-sm font-semibold text-white">
            Add employee
          </Link>
        }
      />
      {!cards.length ? (
        <EmptyState title="No employees yet" body="Add the people who work in this shop. You can pay them from each profile." />
      ) : (
        <EmployeeBoard employees={cards} />
      )}
    </>
  );
}
