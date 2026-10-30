import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { formatDateTime, money } from "@/lib/format";

export default async function CustomerReceiptsPage() {
  const profile = await requireRole("customer");
  const supabase = await createServerSupabase();
  const { data: receipts } = await supabase
    .from("receipts")
    .select("id, receipt_number, total, created_at, shop_details")
    .eq("customer_id", profile.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader title="Receipts" subtitle="Official receipts generated from completed transactions. Open one to print it or save it as an image or PDF." />
      {!receipts?.length ? (
        <EmptyState title="No receipts yet" body="Receipts appear after a shop completes an order." />
      ) : (
        <div className="grid gap-3">
          {receipts.map((receipt) => (
            <Link key={receipt.id} href={`/customer/receipts/${receipt.id}`} className="rounded-2xl bg-white p-4">
              <p className="font-semibold">{receipt.receipt_number}</p>
              <p className="text-sm text-[#6B7280]">
                {(receipt.shop_details as { name?: string } | null)?.name} · {money(receipt.total)} · {formatDateTime(receipt.created_at)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
