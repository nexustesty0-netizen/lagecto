import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/primitives";
import { QuoteEditor } from "@/components/shop/QuoteEditor";

export default async function NewQuotationPage() {
  const { shop } = await getOwnedShop();
  if (!shop) return null;
  const supabase = await createServerSupabase();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, stock, type, barcode")
    .eq("shop_id", shop.id)
    .eq("is_available", true)
    .order("name");

  return (
    <>
      <PageHeader title="New quotation" subtitle="Pick a format, add lines, and send it as a quote — not a receipt." />
      <QuoteEditor
        shopName={shop.name}
        products={products || []}
        shopDetails={{
          name: shop.name,
          address: shop.address,
          phone: shop.phone,
          email: shop.email,
          whatsapp: shop.whatsapp_number,
          website: shop.website_url,
          logo_url: shop.logo_url,
        }}
      />
    </>
  );
}
