import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/primitives";
import { createServerSupabase } from "@/lib/supabase/server";
import { CampaignAdminForm } from "@/components/admin/CampaignAdminForm";

export default async function AdminCampaignsPage() {
  await requireRole("admin");
  const supabase = await createServerSupabase();
  const { data: campaigns } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
  return (
    <>
      <PageHeader title="Campaigns" subtitle="Founding Users and other configurable campaigns. End dates are enforced; this is never a permanent entitlement by default." />
      <CampaignAdminForm campaigns={campaigns || []} />
    </>
  );
}
