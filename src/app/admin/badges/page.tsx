import { requireAdminLevel } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/primitives";
import { createServerSupabase } from "@/lib/supabase/server";
import { BadgeAdminClient } from "@/components/admin/BadgeAdminClient";

export default async function AdminBadgesPage() {
  await requireAdminLevel("admin");
  const supabase = await createServerSupabase();
  const { data: badges } = await supabase
    .from("customer_badge_definitions")
    .select("id, slug, name, description, audience, category, rarity, icon, is_active, is_visible, sort_order")
    .order("audience")
    .order("sort_order");
  return (
    <>
      <PageHeader title="Badges" subtitle="Database-driven definitions. Manual grants require a reason and are written to the audit log." />
      <BadgeAdminClient badges={badges || []} />
    </>
  );
}
