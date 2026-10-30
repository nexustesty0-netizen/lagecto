import { createServerSupabase } from "@/lib/supabase/server";
import { loadOwnedShopWithFeatures } from "@/lib/entitlements";
import { PageHeader } from "@/components/ui/primitives";
import { ShopSteboHub } from "@/components/stebo/ShopSteboHub";

export default async function ShopSteboPage() {
  const { profile, shop } = await loadOwnedShopWithFeatures();
  const supabase = await createServerSupabase();
  const [{ data: goals }, { data: briefings }, { data: reports }, { data: weekly }] = await Promise.all([
    supabase.from("stebo_goals").select("*").eq("user_id", profile.id).order("created_at", { ascending: false }),
    supabase.from("stebo_briefings").select("*").eq("user_id", profile.id).order("created_at", { ascending: false }),
    supabase.from("stebo_reports").select("*").eq("user_id", profile.id).order("created_at", { ascending: false }),
    shop
      ? supabase
          .from("stebo_weekly_reports")
          .select("id, week_start, title, body, generated_at")
          .eq("scope", "shop")
          .eq("subject_id", shop.id)
          .order("week_start", { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] }),
  ]);
  return (
    <>
      <PageHeader title="Stebo Business" subtitle="Strategy, marketing, sales, inventory and weekend analytics for this shop only." />
      <ShopSteboHub userId={profile.id} goals={goals || []} briefings={briefings || []} reports={reports || []} weekly={weekly || []} />
    </>
  );
}
