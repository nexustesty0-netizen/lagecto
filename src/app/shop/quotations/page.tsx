import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui/primitives";
import { formatDateTime, money } from "@/lib/format";
import { QUOTATION_FORMATS } from "@/lib/quotations";

export default async function ShopQuotationsPage() {
  const { shop } = await getOwnedShop();
  if (!shop) return null;
  const supabase = await createServerSupabase();
  const { data: quotes } = await supabase
    .from("quotations")
    .select("id, quote_number, customer_name, total, status, format, valid_until, created_at")
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader
        title="Quotations"
        subtitle="Send estimates and proposals without recording a sale. Choose a format that matches the job."
        action={
          <Link href="/shop/quotations/new" className="rounded-full bg-[#0B6E4F] px-4 py-2 text-white">
            New quotation
          </Link>
        }
      />
      {!quotes?.length ? (
        <EmptyState
          title="No quotations yet"
          body="Create a formal quote, proposal, estimate, letterhead, or quick quote."
          action={
            <Link href="/shop/quotations/new" className="inline-flex rounded-full bg-[#0B6E4F] px-4 py-2 text-sm font-semibold text-white">
              New quotation
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3">
          {quotes.map((quote) => (
            <Link key={quote.id} href={`/shop/quotations/${quote.id}`} className="rounded-2xl bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{quote.quote_number}</p>
                <StatusBadge value={quote.status} />
              </div>
              <p className="mt-1 text-sm text-[#6B7280]">
                {quote.customer_name || "No customer"} · {money(quote.total)} ·{" "}
                {QUOTATION_FORMATS.find((row) => row.id === quote.format)?.label || quote.format} · {formatDateTime(quote.created_at)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
