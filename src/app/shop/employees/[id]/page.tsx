import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { featureLockReason, loadOwnedShopWithFeatures } from "@/lib/entitlements";
import { PageHeader, StatusBadge } from "@/components/ui/primitives";
import { FeatureLocked } from "@/components/shop/FeatureLocked";
import { DeactivateEmployeeButton, PayrollActions } from "@/components/shop/EmployeeActions";
import { InitialsAvatar } from "@/components/os/OsUi";
import { formatDate, money, titleCase } from "@/lib/format";

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { shop, features, disabledFeatures } = await loadOwnedShopWithFeatures();
  if (!shop) return null;
  const locked = featureLockReason(features, disabledFeatures, "employees");
  if (locked) return <FeatureLocked feature="employees" reason={locked} />;
  const supabase = await createServerSupabase();
  const { data: employee } = await supabase.from("employees").select("*").eq("id", id).eq("shop_id", shop.id).maybeSingle();
  if (!employee) notFound();
  const { data: payroll } = await supabase
    .from("payroll_records")
    .select("id, net_pay, gross_pay, deductions, bonuses, status, period_start, period_end, payment_date, created_at")
    .eq("shop_id", shop.id)
    .eq("employee_id", employee.id)
    .order("created_at", { ascending: false });
  const paid = (payroll || []).filter((row) => row.status === "paid").reduce((sum, row) => sum + Number(row.net_pay || 0), 0);
  const pending = (payroll || []).filter((row) => row.status === "pending" || row.status === "approved" || row.status === "draft");

  return (
    <>
      <PageHeader
        title={employee.name}
        subtitle={employee.employee_number || "Employee profile"}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={`/shop/employees/${employee.id}/edit`} className="rounded-full border px-4 py-2 text-sm">
              Edit
            </Link>
            {employee.status === "active" ? <DeactivateEmployeeButton employeeId={employee.id} name={employee.name} /> : null}
          </div>
        }
      />
      <div className="mb-6 flex items-center gap-4 os-surface">
        <InitialsAvatar name={employee.name} photoUrl={employee.photo_url} size={72} />
        <div>
          <p className="font-semibold">{employee.role_title || "No title yet"}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge value={employee.status || (employee.is_active ? "active" : "inactive")} />
            {employee.department ? <span className="badge bg-[#f3eee0]">{employee.department}</span> : null}
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="os-surface">
          <p className="os-kicker">Personal</p>
          <dl className="mt-3 grid gap-2 text-sm">
            <Row label="Phone" value={employee.phone} />
            <Row label="Email" value={employee.email} />
            <Row label="Address" value={employee.address} />
            <Row label="Emergency" value={[employee.emergency_contact_name, employee.emergency_contact_phone].filter(Boolean).join(" · ")} />
          </dl>
        </section>
        <section className="os-surface">
          <p className="os-kicker">Employment</p>
          <dl className="mt-3 grid gap-2 text-sm">
            <Row label="Type" value={titleCase(employee.employment_type)} />
            <Row label="Started" value={formatDate(employee.start_date)} />
            <Row label="Pay frequency" value={titleCase(employee.pay_frequency)} />
            <Row label="Salary / wage" value={money(employee.salary)} />
            <Row label="Payment details" value={employee.payment_details} />
          </dl>
        </section>
      </div>
      {employee.notes ? (
        <section className="os-surface mt-4">
          <p className="os-kicker">Notes</p>
          <p className="mt-2 whitespace-pre-wrap text-sm">{employee.notes}</p>
        </section>
      ) : null}
      {features.has("payroll") ? (
        <section className="os-surface mt-4">
          <p className="os-kicker">Payroll</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <p className="text-sm">Current pay {money(employee.salary)}</p>
            <p className="text-sm">Paid this history {money(paid)}</p>
            <p className="text-sm">Open drafts {pending.length}</p>
          </div>
          <div className="mt-4">
            <PayrollActions
              employeeId={employee.id}
              records={(payroll || []).map((row) => ({ id: row.id, status: row.status, net_pay: Number(row.net_pay || 0) }))}
            />
          </div>
          <div className="app-table-wrap mt-4">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Gross</th>
                  <th>Net</th>
                  <th>Status</th>
                  <th>Paid</th>
                </tr>
              </thead>
              <tbody>
                {(payroll || []).map((row) => (
                  <tr key={row.id}>
                    <td>
                      {formatDate(row.period_start)} – {formatDate(row.period_end)}
                    </td>
                    <td>{money(row.gross_pay)}</td>
                    <td>{money(row.net_pay)}</td>
                    <td>
                      <StatusBadge value={row.status} />
                    </td>
                    <td>{formatDate(row.payment_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <p className="mt-4 text-sm text-[var(--lagecto-muted)]">Payroll is not available on this shop’s current access.</p>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[var(--lagecto-muted)]">{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}
