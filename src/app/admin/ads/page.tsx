import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/primitives";
import { AdsManager } from "@/components/admin/AdsManager";

export default async function AdminAdsPage() {
  await requireRole("admin");
  const supabase = await createServerSupabase();
  const { data: ads } = await supabase.from("marketplace_ads").select("*").order("created_at", { ascending: false });
  return (
    <>
      <PageHeader title="Ads" subtitle="Marketplace banners and featured placements. Shops are not billed unless a billing system is added." />
      <AdsManager ads={ads || []} />
    </>
  );
}
