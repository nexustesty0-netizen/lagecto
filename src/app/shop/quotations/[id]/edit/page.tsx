import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/primitives";
import { QuoteEditor } from "@/components/shop/QuoteEditor";
import type { QuotationRecord } from "@/lib/quotations";

export default async function EditQuotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { shop } = await getOwnedShop();
  if (!shop) return null;
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: quote } = await supabase.from("quotations").select("*").eq("id", id).eq("shop_id", shop.id).maybeSingle();
  if (!quote) notFound();
  const [{ data: items }, { data: products }] = await Promise.all([
    supabase.from("quotation_items").select("*").eq("quotation_id", id),
    supabase.from("products").select("id, name, price, stock, type, barcode").eq("shop_id", shop.id).eq("is_available", true).order("name"),
  ]);
  const packed: QuotationRecord = { ...quote, items: items || [] };

  return (
    <>
      <PageHeader title={`Edit ${quote.quote_number}`} subtitle="Change the format, lines, or customer details." />
      <QuoteEditor
        shopName={shop.name}
        products={products || []}
        initial={packed}
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
