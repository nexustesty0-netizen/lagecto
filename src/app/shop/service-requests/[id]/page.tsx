import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { PageHeader, StatusBadge } from "@/components/ui/primitives";
import { StatusPatch } from "@/components/forms/StatusPatch";
import { formatDateTime } from "@/lib/format";

export default async function ShopEnquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { shop } = await getOwnedShop();
  if (!shop) return null;
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: row } = await supabase.from("service_requests").select("*").eq("id", id).eq("shop_id", shop.id).maybeSingle();
  if (!row) notFound();

  return (
    <>
      <PageHeader
        title={row.title}
        subtitle={row.customer_name || "Enquiry"}
        action={
          <Link href="/shop/service-requests" className="text-sm font-medium text-[#0B6E4F]">
            All enquiries
          </Link>
        }
      />
      <article className="rounded-2xl bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusBadge value={row.status} />
          <p className="text-xs text-[var(--lagecto-muted)]">{formatDateTime(row.created_at)}</p>
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-7">{row.details || "No extra details were saved."}</p>
        <div className="mt-5">
          <StatusPatch table="service_requests" id={row.id} options={["open", "quoted", "accepted", "closed", "cancelled"]} />
        </div>
      </article>
    </>
  );
}
