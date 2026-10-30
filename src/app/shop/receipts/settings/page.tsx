import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/primitives";
import { ReceiptDesigner } from "@/components/shop/ReceiptDesigner";
import { designFromShop } from "@/lib/receipts";

export default async function ReceiptSettingsPage() {
  const { shop } = await getOwnedShop();
  if (!shop) return null;
  const supabase = await createServerSupabase();
  const { data: storefront } = await supabase
    .from("shop_storefront_config")
    .select("primary_color, secondary_color, accent_color, background_color")
    .eq("shop_id", shop.id)
    .maybeSingle();
  const design = designFromShop({
    receipt_template: shop.receipt_template,
    receipt_header: shop.receipt_header,
    receipt_footer: shop.receipt_footer,
    receipt_customization: shop.receipt_customization as Record<string, unknown> | null,
    storefront,
  });
  return (
    <>
      <PageHeader
        title="Receipt design"
        subtitle="Pick an invoice layout. Receipt date is always shown, and your shop phone and email print once."
      />
      <ReceiptDesigner
        shopName={shop.name}
        logoUrl={shop.logo_url}
        initial={design}
        contact={{
          address: shop.address,
          phone: shop.phone,
          email: shop.email,
          whatsapp: shop.whatsapp_number,
          website: shop.website_url,
        }}
      />
    </>
  );
}
