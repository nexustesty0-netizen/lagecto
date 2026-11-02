import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui/primitives";
import { StatusPatch } from "@/components/forms/StatusPatch";

export default async function ServiceRequestsPage() {
  const { shop } = await getOwnedShop();
  if (!shop) return null;
  const supabase = await createServerSupabase();
  const { data: requests } = await supabase.from("service_requests").select("*").eq("shop_id", shop.id).order("created_at", { ascending: false });
  return (
    <>
      <PageHeader title="Service requests" />
      {!requests?.length ? (
        <EmptyState title="No requests" body="Custom service requests from customers will appear here." />
      ) : (
        <div className="grid gap-3">
          {requests.map((row) => (
            <article key={row.id} className="rounded-2xl bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <Link href={`/shop/service-requests/${row.id}`} className="font-semibold text-[#0B6E4F]">
                  {row.title}
                </Link>
                <StatusBadge value={row.status} />
              </div>
              <p className="line-clamp-4 whitespace-pre-wrap text-sm text-[#6B7280]">{row.details}</p>
              <div className="mt-2">
                <StatusPatch table="service_requests" id={row.id} options={["open", "quoted", "accepted", "closed", "cancelled"]} />
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
