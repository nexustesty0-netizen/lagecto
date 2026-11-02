import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { ManageUsersClient } from "@/components/admin/ManageUsersClient";
import { canViewAccountContact, effectiveAdminRole } from "@/lib/admin-access";
import { isPlatformOwnerEmail } from "@/lib/brand";

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

  const seeContact = canViewAccountContact(profile);
  const rows = (users || []).map((user) =>
    seeContact || isPlatformOwnerEmail(user.email) ? user : { ...user, email: null },
  );

  return (
    <>
      <PageHeader
        title="Admin users and permissions"
        subtitle="Super admin can do everything, including deleting users. Admin can assign Admin and Manager. Manager can assign shop owners only."
      />
      {!rows.length ? (
        <EmptyState title="No users" body="Users appear after registration." />
      ) : (
        <ManageUsersClient
          users={rows}
          shops={shops || []}
          currentUserId={profile.id}
          currentAdminRole={effectiveAdminRole(profile)}
          currentUserEmail={profile.email}
        />
      )}
    </>
  );
}
