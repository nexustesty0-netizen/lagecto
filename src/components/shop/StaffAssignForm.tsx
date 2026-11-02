"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SHOP_STAFF_ROLES, staffRoleLabel, type AssignedStaffRole } from "@/lib/shop/staff";

type StaffRow = {
  user_id: string;
  role_name: AssignedStaffRole;
  name?: string | null;
  email?: string | null;
  username?: string | null;
};

export function StaffAssignForm({ staff }: { staff: StaffRow[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<AssignedStaffRole>("cashier");
  const [preview, setPreview] = useState<{ name: string; email: string; username: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<StaffRow | null>(null);

  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setPreview(null);
    const res = await fetch("/api/shop/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lookup", email, username }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || data.ok === false) {
      setError(data.error || "No registered person matches that email and username.");
      return;
    }
    setPreview({ name: data.name || "Registered user", email: data.email, username: data.username });
  }

  async function assign() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/shop/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "assign", email, username, role }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || data.ok === false) {
      setError(data.error || "Unable to assign this person.");
      return;
    }
    setEmail("");
    setUsername("");
    setPreview(null);
    router.refresh();
  }

  async function remove() {
    if (!pending) return;
    const res = await fetch("/api/shop/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", userId: pending.user_id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      setError(data.error || "Unable to remove this person.");
      setPending(null);
      return;
    }
    setPending(null);
    router.refresh();
  }

  return (
    <section className="grid gap-4">
      <form onSubmit={(event) => void lookup(event)} className="lg-card grid gap-3 p-4 sm:p-5">
        <h2 className="font-semibold">Assign shop access</h2>
        <p className="text-sm text-[var(--lagecto-muted)]">
          Enter the email and username of someone who already has a LaGecto account. You cannot make a shop owner a cashier, and one email can only log in to one account.
        </p>
        <label className="grid gap-1 text-sm">
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required className="min-h-11 rounded-xl border px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          Username
          <input value={username} onChange={(event) => setUsername(event.target.value)} required className="min-h-11 rounded-xl border px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          Role
          <select value={role} onChange={(event) => setRole(event.target.value as AssignedStaffRole)} className="min-h-11 rounded-xl border px-3 py-2">
            {SHOP_STAFF_ROLES.map((item) => (
              <option key={item} value={item}>
                {staffRoleLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <button disabled={busy} className="min-h-11 rounded-xl border border-[#0B6E4F] px-4 py-2 font-semibold text-[#0B6E4F]">
          {busy ? "Checking…" : "Find registered person"}
        </button>
        {preview ? (
          <div className="rounded-2xl bg-[#F7F3E3] p-3">
            <p className="font-semibold">{preview.name}</p>
            <p className="text-sm text-[var(--lagecto-muted)]">
              {preview.username} · {preview.email}
            </p>
            <button type="button" disabled={busy} onClick={() => void assign()} className="mt-3 min-h-11 rounded-xl bg-[#0B6E4F] px-4 py-2 text-sm font-semibold text-white">
              Make {staffRoleLabel(role).toLowerCase()}
            </button>
          </div>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>

      {staff.length ? (
        <ul className="grid gap-2">
          {staff.map((row) => (
            <li key={row.user_id} className="flex items-center gap-3 rounded-2xl bg-white p-3 sm:p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{row.name || row.email}</p>
                <p className="text-xs text-[var(--lagecto-muted)]">
                  {staffRoleLabel(row.role_name)} · {row.username || row.email}
                </p>
              </div>
              <button type="button" className="min-h-10 px-2 text-sm font-semibold text-[#C2413B]" onClick={() => setPending(row)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--lagecto-muted)]">No cashiers, admins or managers assigned yet.</p>
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        title="Remove shop access?"
        body="They keep their LaGecto account, but they will no longer work in this shop."
        onCancel={() => setPending(null)}
        onConfirm={() => void remove()}
      />
    </section>
  );
}
