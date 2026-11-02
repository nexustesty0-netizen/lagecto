import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { CustomerDesk } from "@/components/admin/CustomerDesk";
import { canViewAccountContact } from "@/lib/admin-access";

export default async function AdminCustomersPage() {
  const profile = await requireRole("admin");
  const supabase = await createServerSupabase();
  const seeContact = canViewAccountContact(profile);
  const { data: customers } = await supabase
    .from("users")
    .select("id, name, email, username, account_status, created_at, last_login_at")
    .eq("role", "customer")
    .order("created_at", { ascending: false })
    .limit(400);
  const rows = (customers || []).map((row) => (seeContact ? row : { ...row, email: null }));

  return (
    <>
      <PageHeader title="Customers" subtitle="Search registered customers. Email is hidden from managers." />
      {!rows.length ? (
        <EmptyState title="No customers" body="Customers appear after they register." />
      ) : (
        <CustomerDesk customers={rows} canSeeContact={seeContact} />
      )}
    </>
  );
}
