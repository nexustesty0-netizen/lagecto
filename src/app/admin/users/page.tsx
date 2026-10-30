import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { ManageUsersClient } from "@/components/admin/ManageUsersClient";

export default async function AdminUsersPage() {
  const profile = await requireRole("admin");
  const supabase = await createServerSupabase();
  const [{ data: users }, { data: shops }] = await Promise.all([
    supabase
      .from("users")
      .select("id, name, email, username, role, admin_role, account_status, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("shops").select("id, name, login_shop_id, owner_user_id, provider_type").order("name"),
  ]);

  return (
    <>
      <PageHeader title="Manage users" subtitle="Super admins can assign managers. Managers can assign shop owners, but cannot see security logs." />
      {!users?.length ? (
        <EmptyState title="No users" body="Users appear after registration." />
      ) : (
        <ManageUsersClient users={users} shops={shops || []} currentUserId={profile.id} currentAdminRole={profile.admin_role} />
      )}
    </>
  );
}
