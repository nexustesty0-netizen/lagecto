"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { EMPLOYMENT_TYPES, PAY_FREQUENCIES } from "@/lib/features";
import { MediaField } from "@/components/media/MediaField";

export type EmployeeFormValues = {
  id?: string;
  name?: string;
  employee_number?: string | null;
  role_title?: string | null;
  department?: string | null;
  employment_type?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  start_date?: string | null;
  salary?: number | null;
  pay_frequency?: string | null;
  payment_details?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  notes?: string | null;
  photo_url?: string | null;
};

export function EmployeeForm({
  employee,
  submitLabel = "Save employee",
}: {
  employee?: EmployeeFormValues;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState(employee?.photo_url || "");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setOk("");
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/shop/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: employee?.id,
        name: form.get("name"),
        employee_number: form.get("employee_number"),
        role_title: form.get("role_title"),
        department: form.get("department"),
        employment_type: form.get("employment_type"),
        phone: form.get("phone"),
        email: form.get("email"),
        address: form.get("address"),
        start_date: form.get("start_date"),
        salary: form.get("salary"),
        pay_frequency: form.get("pay_frequency"),
        payment_details: form.get("payment_details"),
        emergency_contact_name: form.get("emergency_contact_name"),
        emergency_contact_phone: form.get("emergency_contact_phone"),
        notes: form.get("notes"),
        photo_url: photo,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) setError(data.error || "Unable to save this employee.");
    else {
      setOk("Saved.");
      if (!employee?.id && data.id) router.push(`/shop/employees/${data.id}`);
      else router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <OsSection title="Personal information">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Full name" name="name" required defaultValue={employee?.name} />
          <Field label="Employee number" name="employee_number" defaultValue={employee?.employee_number || ""} placeholder="Auto-assigned if blank" />
          <Field label="Phone" name="phone" defaultValue={employee?.phone || ""} />
          <Field label="Email" name="email" type="email" defaultValue={employee?.email || ""} />
          <Field label="Address" name="address" className="md:col-span-2" defaultValue={employee?.address || ""} />
        </div>
        <MediaField label="Photo" value={photo} onChange={(url) => setPhoto(url || "")} purpose="media" hint="Optional. Stored with this shop’s media." />
      </OsSection>
      <OsSection title="Employment">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Job title" name="role_title" defaultValue={employee?.role_title || ""} />
          <Field label="Department" name="department" defaultValue={employee?.department || ""} />
          <label className="grid gap-1 text-sm">
            Employment type
            <select name="employment_type" defaultValue={employee?.employment_type || "full_time"} className="rounded-xl border px-3 py-2">
              {EMPLOYMENT_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <Field label="Start date" name="start_date" type="date" defaultValue={employee?.start_date || ""} />
        </div>
      </OsSection>
      <OsSection title="Payroll">
        <p className="text-sm text-[var(--lagecto-muted)]">Pay is stored on the employee record. Payroll runs use this amount on the server — the browser cannot invent a different salary.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Salary or wage" name="salary" type="number" defaultValue={employee?.salary != null ? String(employee.salary) : ""} />
          <label className="grid gap-1 text-sm">
            Pay frequency
            <select name="pay_frequency" defaultValue={employee?.pay_frequency || "monthly"} className="rounded-xl border px-3 py-2">
              {PAY_FREQUENCIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Payment details"
            name="payment_details"
            className="md:col-span-2"
            defaultValue={employee?.payment_details || ""}
            placeholder="Bank name and last digits only — do not store full card numbers"
          />
        </div>
      </OsSection>
      <OsSection title="Emergency contact">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Contact name" name="emergency_contact_name" defaultValue={employee?.emergency_contact_name || ""} />
          <Field label="Contact phone" name="emergency_contact_phone" defaultValue={employee?.emergency_contact_phone || ""} />
          <label className="grid gap-1 text-sm md:col-span-2">
            Notes
            <textarea name="notes" defaultValue={employee?.notes || ""} className="min-h-24 rounded-xl border px-3 py-2" />
          </label>
        </div>
      </OsSection>
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} className="rounded-full bg-[#0B6E4F] px-5 py-2.5 text-white">
          {busy ? "Saving…" : submitLabel}
        </button>
        <button type="button" className="rounded-full border px-5 py-2.5" onClick={() => router.back()}>
          Cancel
        </button>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {ok ? <p className="text-sm text-[#0B6E4F]">{ok}</p> : null}
    </form>
  );
}

function OsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="os-surface grid gap-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  placeholder,
  className = "",
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const id = useMemo(() => name, [name]);
  return (
    <label className={`grid gap-1 text-sm ${className}`}>
      {label}
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        step={type === "number" ? "0.01" : undefined}
        min={type === "number" ? "0" : undefined}
        className="rounded-xl border px-3 py-2"
      />
    </label>
  );
}
