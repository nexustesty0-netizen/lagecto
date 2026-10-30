import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { formatDateTime, money } from "@/lib/format";

export default async function ShopReceiptsPage() {
  const { shop } = await getOwnedShop();
  if (!shop) return null;
  const supabase = await createServerSupabase();
  const { data: receipts } = await supabase
    .from("receipts")
    .select("id, receipt_number, total, customer_name, created_at")
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader
        title="Shop receipts"
        subtitle="Open a receipt to print it, save it as an image or PDF, correct a mistake, or delete it. Deleting a receipt also removes the linked sale and returns stock."
        action={
          <Link href="/shop/receipts/settings" className="rounded-full bg-[#0B6E4F] px-4 py-2 text-white">
            Receipt design
          </Link>
        }
      />
      {!receipts?.length ? (
        <EmptyState title="No receipts" body="Complete a POS sale or order to generate a receipt." />
      ) : (
        <div className="grid gap-3">
          {receipts.map((receipt) => (
            <Link key={receipt.id} href={`/shop/receipts/${receipt.id}`} className="rounded-2xl bg-white p-4">
              <p className="font-semibold">{receipt.receipt_number}</p>
              <p className="text-sm text-[#6B7280]">
                {receipt.customer_name || "Walk-in"} · {money(receipt.total)} · {formatDateTime(receipt.created_at)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
