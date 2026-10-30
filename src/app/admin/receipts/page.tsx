import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { formatDateTime, money } from "@/lib/format";

export default async function AdminReceiptsPage() {
  await requireRole("admin");
  const supabase = await createServerSupabase();
  const { data: receipts } = await supabase
    .from("platform_receipts")
    .select("id, receipt_number, total, customer_name, payment_method, created_at")
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader title="LaGecto receipts" subtitle="Receipts from LaGecto platform POS — separate from shop receipts." />
      {!receipts?.length ? (
        <EmptyState title="No receipts yet" body="Record a payment from Point of sale." />
      ) : (
        <div className="grid gap-3">
          {receipts.map((receipt) => (
            <Link key={receipt.id} href={`/admin/receipts/${receipt.id}`} className="lg-card p-4">
              <p className="font-semibold">{receipt.receipt_number}</p>
              <p className="text-sm text-[#6B7280]">
                {receipt.customer_name || "Walk-in"} · {money(receipt.total)} · {receipt.payment_method} · {formatDateTime(receipt.created_at)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
