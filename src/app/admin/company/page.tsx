import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/primitives";
import { CompanyForm } from "@/components/admin/CompanyForm";

export default async function CompanyPage() {
  await requireRole("admin");
  const supabase = await createServerSupabase();
  const { data: profile } = await supabase.from("lagecto_company_profile").select("*").eq("id", 1).maybeSingle();
  return (
    <>
      <PageHeader title="Company profile" subtitle="Public LaGecto identity used on the website." />
      {profile ? <CompanyForm profile={profile} /> : <p>Company profile is missing.</p>}
    </>
  );
}
