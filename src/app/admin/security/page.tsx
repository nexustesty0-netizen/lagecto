import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { canSeeAdminLogs } from "@/lib/admin-access";
import { redirect } from "next/navigation";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui/primitives";
import { UnlockButton } from "@/components/admin/UnlockButton";
import { formatDateTime } from "@/lib/format";

export default async function SecurityPage() {
  const profile = await requireRole("admin");
  if (!canSeeAdminLogs(profile)) redirect("/403");
  const supabase = await createServerSupabase();
  const [{ data: locked }, { data: events }] = await Promise.all([
    supabase
      .from("users")
      .select("id, name, email, username, role, account_status, locked_at, locked_reason, failed_login_attempts")
      .in("account_status", ["locked", "suspended", "disabled"])
      .order("locked_at", { ascending: false }),
    supabase.from("security_events").select("id, event_type, identifier, result, created_at").order("created_at", { ascending: false }).limit(20),
  ]);

  return (
    <>
      <PageHeader title="Security" subtitle="Unlock accounts locked after repeated failed logins. Actions are audit logged." />
      {!locked?.length ? (
        <EmptyState title="No locked or banned users" body="Accounts locked after 5 failed logins will appear here." />
      ) : (
        <div className="app-table-wrap">
          <table className="app-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Attempts</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {locked.map((user) => (
                <tr key={user.id}>
                  <td>
                    {user.name || user.username}
                    <div className="text-xs text-[#6B7280]">{user.email}</div>
                  </td>
                  <td>{user.role}</td>
                  <td>
                    <StatusBadge value={user.account_status} />
                  </td>
                  <td>{user.locked_reason || "—"}</td>
                  <td>{user.failed_login_attempts}</td>
                  <td>
                    <UnlockButton userId={user.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h2 className="mb-3 mt-8 text-lg font-semibold">Recent audit log</h2>
      <div className="grid gap-2">
        {(events || []).map((event) => (
          <p key={event.id} className="rounded-xl bg-white px-4 py-2 text-sm">
            {event.event_type} · {event.identifier || "—"} · {event.result} · {formatDateTime(event.created_at)}
          </p>
        ))}
      </div>
    </>
  );
}
