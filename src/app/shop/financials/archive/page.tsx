import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { formatDate, money } from "@/lib/format";

export default async function ArchiveListPage() {
  const { shop } = await getOwnedShop();
  if (!shop) return null;
  const supabase = await createServerSupabase();
  const { data: periods } = await supabase
    .from("financial_periods")
    .select("*")
    .eq("shop_id", shop.id)
    .eq("is_current", false)
    .order("started_at", { ascending: false });

  return (
    <>
      <PageHeader title="Archived periods" subtitle="Read-only historical financial records." />
      {!periods?.length ? (
        <EmptyState title="No archives yet" body="When you start a new period, the previous one appears here." />
      ) : (
        <div className="grid gap-3">
          {periods.map((period) => {
            const snapshot = (period.snapshot || {}) as {
              revenue?: number;
              expenses?: number;
              profit?: number;
              transactions?: number;
            };
            return (
              <Link key={period.id} href={`/shop/financials/archive/${period.id}`} className="rounded-2xl bg-white p-5">
                <p className="font-semibold">{period.label}</p>
                <p className="text-sm text-[#6B7280]">
                  {formatDate(period.started_at)} – {formatDate(period.ended_at)}
                </p>
                <p className="mt-2 text-sm">
                  Revenue {money(snapshot.revenue)} · Expenses {money(snapshot.expenses)} · Profit {money(snapshot.profit)}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
