import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { featureLockReason, getCurrentPeriod, loadOwnedShopWithFeatures } from "@/lib/entitlements";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui/primitives";
import { FeatureLocked } from "@/components/shop/FeatureLocked";
import { money, formatDate } from "@/lib/format";

export default async function PayrollPage() {
  const { shop, features, disabledFeatures } = await loadOwnedShopWithFeatures();
  if (!shop) return null;
  const locked = featureLockReason(features, disabledFeatures, "payroll");
  if (locked) return <FeatureLocked feature="payroll" reason={locked} />;
  const supabase = await createServerSupabase();
  const period = await getCurrentPeriod(shop.id);
  const [{ data: payroll }, { data: employees }] = await Promise.all([
    supabase
      .from("payroll_records")
      .select("*")
      .eq("shop_id", shop.id)
      .eq("period_id", period?.id || "00000000-0000-0000-0000-000000000000")
      .order("created_at", { ascending: false }),
    supabase.from("employees").select("id, name").eq("shop_id", shop.id).eq("status", "active"),
  ]);
  const paid = (payroll || []).filter((row) => row.status === "paid").reduce((sum, row) => sum + Number(row.net_pay || 0), 0);

  return (
    <>
      <PageHeader
        title="Payroll"
        subtitle={`Current period: ${period?.label || "none"}. Pay is created from each employee’s stored salary.`}
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <article className="os-surface">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--lagecto-muted)]">Paid this period</p>
          <p className="mt-2 text-2xl font-semibold">{money(paid)}</p>
        </article>
        <article className="os-surface">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--lagecto-muted)]">Records</p>
          <p className="mt-2 text-2xl font-semibold">{payroll?.length || 0}</p>
        </article>
        <article className="os-surface">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--lagecto-muted)]">Active staff</p>
          <p className="mt-2 text-2xl font-semibold">{employees?.length || 0}</p>
        </article>
      </div>
      <p className="mb-4 text-sm text-[var(--lagecto-muted)]">
        Open an employee profile to create a draft, approve, and mark paid. Paid amounts feed the shop profit and loss for this period.
      </p>
      <div className="mb-6 flex flex-wrap gap-2">
        {(employees || []).map((employee) => (
          <Link key={employee.id} href={`/shop/employees/${employee.id}`} className="rounded-full border px-4 py-2 text-sm">
            {employee.name}
          </Link>
        ))}
      </div>
      {!payroll?.length ? (
        <EmptyState title="No payroll records" body="Create pay from an employee profile. The amount comes from their saved salary." />
      ) : (
        <div className="app-table-wrap">
          <table className="app-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Net</th>
                <th>Status</th>
                <th>Paid on</th>
              </tr>
            </thead>
            <tbody>
              {payroll.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.employee_id ? (
                      <Link href={`/shop/employees/${row.employee_id}`} className="font-semibold text-[#0B6E4F]">
                        {row.employee_name}
                      </Link>
                    ) : (
                      row.employee_name
                    )}
                  </td>
                  <td>{money(row.net_pay)}</td>
                  <td>
                    <StatusBadge value={row.status} />
                  </td>
                  <td>{formatDate(row.payment_date || row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
