import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui/primitives";

export default async function CustomerRequestsPage() {
  const profile = await requireRole("customer");
  const supabase = await createServerSupabase();
  const { data: requests } = await supabase.from("service_requests").select("*, shops(name)").eq("customer_id", profile.id).order("created_at", { ascending: false });
  return (
    <>
      <PageHeader title="My enquiries" subtitle="Custom requests you sent to shops. Product chats are in Messages." />
      {!requests?.length ? (
        <EmptyState title="No requests" body="Send a custom request from a shop page." />
      ) : (
        <div className="grid gap-3">
          {requests.map((row) => (
            <article key={row.id} className="rounded-2xl bg-white p-4">
              <Link href={`/customer/requests/${row.id}`} className="font-semibold text-[#0B6E4F]">
                {row.title}
              </Link>
              <p className="text-sm text-[#6B7280]">{(row.shops as { name?: string } | null)?.name}</p>
              <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-[#6B7280]">{row.details}</p>
              <StatusBadge value={row.status} />
            </article>
          ))}
        </div>
      )}
    </>
  );
}
