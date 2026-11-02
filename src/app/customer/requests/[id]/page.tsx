import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, StatusBadge } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/format";

export default async function CustomerEnquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole("customer");
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: row } = await supabase
    .from("service_requests")
    .select("id, title, details, status, created_at, shops(name)")
    .eq("id", id)
    .eq("customer_id", profile.id)
    .maybeSingle();
  if (!row) notFound();
  const shop = Array.isArray(row.shops) ? row.shops[0] : row.shops;

  return (
    <>
      <PageHeader
        title={row.title}
        subtitle={shop?.name || "Enquiry"}
        action={
          <Link href="/customer/requests" className="text-sm font-medium text-[#0B6E4F]">
            All enquiries
          </Link>
        }
      />
      <article className="rounded-2xl bg-white p-5">
        <StatusBadge value={row.status} />
        <p className="mt-4 whitespace-pre-wrap text-sm leading-7">{row.details || "No extra details were saved."}</p>
        <p className="mt-4 text-xs text-[var(--lagecto-muted)]">{formatDateTime(row.created_at)}</p>
      </article>
    </>
  );
}
