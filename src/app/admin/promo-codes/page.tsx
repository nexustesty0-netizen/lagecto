import { requireAdminLevel } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/primitives";
import { createServerSupabase } from "@/lib/supabase/server";
import { PromoCodeAdminForm } from "@/components/loyalty/PromoCodeForm";

export default async function AdminPromoCodesPage() {
  await requireAdminLevel("admin");
  const supabase = await createServerSupabase();
  const { data: program } = await supabase.from("loyalty_programs").select("id").eq("scope", "platform").maybeSingle();
  const [{ data: codes }, { data: levels }] = await Promise.all([
    supabase.from("promo_codes").select("*").eq("owner_scope", "platform").order("created_at", { ascending: false }),
    program
      ? supabase.from("loyalty_levels").select("id, name").eq("program_id", program.id).eq("is_active", true).order("rank")
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  return (
    <>
      <PageHeader title="Platform promo codes" subtitle="Validated at checkout. Shop codes cannot be created here." />
      <PromoCodeAdminForm codes={codes || []} levels={levels || []} scope="platform" />
    </>
  );
}
