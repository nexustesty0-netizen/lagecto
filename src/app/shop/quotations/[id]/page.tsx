import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { QuoteDetail } from "@/components/shop/QuoteDetail";
import type { QuotationRecord } from "@/lib/quotations";

export default async function QuotationDetailPage({
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
  const { data: items } = await supabase.from("quotation_items").select("*").eq("quotation_id", id);
  const packed: QuotationRecord = { ...quote, items: items || [] };

  return (
    <div>
      <Link href="/shop/quotations" className="text-sm text-[#0B6E4F]">
        Back to quotations
      </Link>
      <div className="mt-4">
        <QuoteDetail quote={packed} />
      </div>
    </div>
  );
}
