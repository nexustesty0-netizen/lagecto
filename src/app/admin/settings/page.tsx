import { requireRole } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/primitives";
import { ProfileSettingsForm } from "@/components/settings/ProfileSettingsForm";
import { CONTACT } from "@/lib/brand";
import { AdminPaymentConfigForm } from "@/components/admin/AdminPaymentConfigForm";
import { SelfServeShopToggle } from "@/components/admin/SelfServeShopToggle";
import { getPaymentPublicConfig } from "@/lib/payments/config";
import { selfServeShopCreationEnabled } from "@/lib/platform-flags.server";
import type { PaymentMethod } from "@/lib/payments/methods";

export default async function AdminSettingsPage() {
  const profile = await requireRole("admin");
  const supabase = await createServerSupabase();
  const [{ data }, selfServe] = await Promise.all([
    supabase.from("platform_payment_config").select("enabled_methods").eq("id", 1).maybeSingle(),
    selfServeShopCreationEnabled(),
  ]);
  const config = getPaymentPublicConfig();
  return (
    <>
      <PageHeader title="Settings" />
      <div className="mb-6">
        <SelfServeShopToggle enabled={selfServe} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileSettingsForm profile={profile} />
        <AdminPaymentConfigForm
          enabledMethods={(data?.enabled_methods as PaymentMethod[]) || ["visa", "mastercard", "ecocash", "cash"]}
          provider={config.provider}
          mode={config.mode}
          paynowConfigured={config.paynowConfigured}
        />
      </div>
      <div className="mt-6 rounded-2xl bg-white p-5">
        <h2 className="font-semibold">LaGecto Support</h2>
        <p className="mt-2 text-sm">{CONTACT.phoneDisplay}</p>
        <p className="text-sm">{CONTACT.email}</p>
      </div>
    </>
  );
}
