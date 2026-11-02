"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { InitialsAvatar, SegmentedControl } from "@/components/os/OsUi";
import { money, titleCase } from "@/lib/format";
import { StatusBadge } from "@/components/ui/primitives";

export type EmployeeCardRow = {
  id: string;
  name: string;
  employee_number?: string | null;
  role_title?: string | null;
  department?: string | null;
  status?: string | null;
  is_active?: boolean | null;
  photo_url?: string | null;
  salary?: number | null;
  latest_payroll_status?: string | null;
};

export function EmployeeBoard({ employees }: { employees: EmployeeCardRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("active");

  const rows = useMemo(() => {
    return employees.filter((row) => {
      const hay = `${row.name} ${row.role_title || ""} ${row.employee_number || ""} ${row.department || ""}`.toLowerCase();
      const matchesQuery = hay.includes(query.trim().toLowerCase());
      const active = row.status ? row.status === "active" : Boolean(row.is_active);
      const matchesFilter = filter === "all" || (filter === "active" && active) || (filter === "inactive" && !active);
      return matchesQuery && matchesFilter;
    });
  }, [employees, query, filter]);

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, title, or number"
          className="min-w-0 flex-1 rounded-xl border px-3 py-2"
        />
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          options={[
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
            { value: "all", label: "All" },
          ]}
        />
      </div>
      {!rows.length ? (
        <p className="text-sm text-[var(--lagecto-muted)]">No employees match this search.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((employee) => (
            <Link key={employee.id} href={`/shop/employees/${employee.id}`} className="os-surface block">
              <div className="flex items-start gap-3">
                <InitialsAvatar name={employee.name} photoUrl={employee.photo_url} />
                <div className="min-w-0">
                  <p className="font-semibold">{employee.name}</p>
                  <p className="text-sm text-[var(--lagecto-muted)]">{employee.role_title || "No title yet"}</p>
                  <p className="mt-1 font-mono text-xs text-[var(--lagecto-muted)]">{employee.employee_number || "—"}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <StatusBadge value={employee.status || (employee.is_active ? "active" : "inactive")} />
                {employee.department ? <span className="badge bg-[#f3eee0] text-[var(--lagecto-muted)]">{employee.department}</span> : null}
                {employee.latest_payroll_status ? (
                  <span className="text-[var(--lagecto-muted)]">Pay {titleCase(employee.latest_payroll_status)}</span>
                ) : (
                  <span className="text-[var(--lagecto-muted)]">{money(employee.salary)}</span>
                )}
              </div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#0B6E4F]">View profile</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
