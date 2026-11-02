import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { featureLockReason, loadOwnedShopWithFeatures } from "@/lib/entitlements";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { FeatureLocked } from "@/components/shop/FeatureLocked";
import { EmployeeBoard } from "@/components/shop/EmployeeBoard";
import { StaffAssignForm } from "@/components/shop/StaffAssignForm";
import { staffIsOwner } from "@/lib/shop/staff";
import type { AssignedStaffRole } from "@/lib/shop/staff";

export default async function EmployeesPage() {
  const { shop, features, disabledFeatures, staffRole } = await loadOwnedShopWithFeatures();
  if (!shop) return null;
  const supabase = await createServerSupabase();
  const staffRes = staffIsOwner(staffRole) ? await supabase.rpc("shop_list_staff") : null;
  const staff = Array.isArray(staffRes?.data?.staff)
    ? (staffRes.data.staff as { user_id: string; role_name: AssignedStaffRole; name?: string | null; email?: string | null; username?: string | null }[])
    : [];

  const locked = featureLockReason(features, disabledFeatures, "employees");

  return (
    <>
      <PageHeader
        title="People"
        subtitle="Assign a registered person as cashier, admin or manager. Employee records below are for payroll."
        action={
          locked ? null : (
            <Link href="/shop/employees/new" className="rounded-full bg-[#0B6E4F] px-4 py-2 text-sm font-semibold text-white">
              Add employee
            </Link>
          )
        }
      />
      {staffIsOwner(staffRole) ? (
        <div className="mb-6">
          <StaffAssignForm staff={staff} />
        </div>
      ) : null}
      {locked ? (
        <FeatureLocked feature="employees" reason={locked} />
      ) : (
        <EmployeeList shopId={shop.id} />
      )}
    </>
  );
}

async function EmployeeList({ shopId }: { shopId: string }) {
  const supabase = await createServerSupabase();
  const [{ data: employees }, { data: payroll }] = await Promise.all([
    supabase.from("employees").select("*").eq("shop_id", shopId).order("name"),
    supabase.from("payroll_records").select("employee_id, status, created_at").eq("shop_id", shopId).order("created_at", { ascending: false }),
  ]);
  const latest = new Map<string, string>();
  for (const row of payroll || []) {
    if (row.employee_id && !latest.has(row.employee_id)) latest.set(row.employee_id, row.status);
  }
  const cards = (employees || []).map((row) => ({
    ...row,
    latest_payroll_status: latest.get(row.id) || null,
  }));
  if (!cards.length) {
    return (
      <EmptyState
        title="No employees yet"
        body="Add the people who work in this shop. You can pay them from each profile."
        action={
          <Link href="/shop/employees/new" className="inline-flex rounded-full bg-[#0B6E4F] px-4 py-2 text-sm font-semibold text-white">
            Add employee
          </Link>
        }
      />
    );
  }
  return <EmployeeBoard employees={cards} />;
}
