import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui/primitives";
import { ShopRegistrationActions, VerificationActions } from "@/components/admin/VerificationActions";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";
import { categoryLabel } from "@/lib/brand";
import { formatDateTime } from "@/lib/format";

export default async function VerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireRole("admin");
  const { tab } = await searchParams;
  const current = tab === "requests" || tab === "registrations" ? tab : "verified";
  const supabase = await createServerSupabase();
  const [{ data: verifiedShops }, { data: requests }, { data: shopRequests }] = await Promise.all([
    supabase
      .from("shops")
      .select("id, name, login_shop_id, owner_name, owner_email, category, verification_status, slug")
      .eq("verification_status", "verified")
      .order("name"),
    supabase.from("verification_requests").select("id, status, notes, created_at, shops(name, login_shop_id)").order("created_at", { ascending: false }),
    supabase.from("shop_registration_requests").select("*").order("created_at", { ascending: false }),
  ]);

  const tabs = [
    { id: "verified", label: "Verified shops", count: verifiedShops?.length || 0 },
    { id: "requests", label: "Verification requests", count: requests?.length || 0 },
    { id: "registrations", label: "Shop requests", count: shopRequests?.length || 0 },
  ];

  return (
    <>
      <PageHeader title="Verification" subtitle="Verified shops, badge requests, and new shop registrations." />
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={item.id === "verified" ? "/admin/verification" : `/admin/verification?tab=${item.id}`}
            className={`rounded-full px-4 py-2 text-sm font-medium ${current === item.id ? "bg-[#0B6E4F] text-white" : "border bg-white"}`}
          >
            {item.label} ({item.count})
          </Link>
        ))}
      </div>

      {current === "verified" ? (
        !verifiedShops?.length ? (
          <EmptyState title="No verified shops" body="Shops become verified while a paid package is active." />
        ) : (
          <div className="grid gap-3">
            {verifiedShops.map((shop) => (
              <article key={shop.id} className="lg-card flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{shop.name}</p>
                    <VerifiedBadge verified />
                  </div>
                  <p className="text-sm text-[#6B7280]">
                    {shop.login_shop_id} · {shop.owner_name || shop.owner_email} · {categoryLabel(shop.category)}
                  </p>
                </div>
                {shop.slug ? (
                  <Link href={`/s/${shop.slug}`} className="text-sm font-semibold text-[#0B6E4F]">
                    Storefront
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        )
      ) : null}

      {current === "requests" ? (
        !requests?.length ? (
          <EmptyState title="No verification requests" body="Requests appear here if a shop submits extra documents." />
        ) : (
          <div className="grid gap-3">
            {requests.map((request) => (
              <article key={request.id} className="lg-card p-4">
                <p className="font-semibold">{(request.shops as { name?: string } | null)?.name}</p>
                <StatusBadge value={request.status} />
                <p className="mt-2 text-sm text-[#6B7280]">{request.notes}</p>
                <VerificationActions table="verification_requests" id={request.id} />
              </article>
            ))}
          </div>
        )
      ) : null}

      {current === "registrations" ? (
        !shopRequests?.length ? (
          <EmptyState title="No shop requests" body="Public shop registration requests will appear here." />
        ) : (
          <div className="grid gap-3">
            {shopRequests.map((request) => (
              <article key={request.id} className="lg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{request.shop_name}</p>
                    <p className="text-sm text-[#6B7280]">
                      {request.contact_name} · {request.phone}
                      {request.email ? ` · ${request.email}` : ""}
                    </p>
                  </div>
                  <StatusBadge value={request.status} />
                </div>
                <p className="mt-2 text-sm text-[#6B7280]">
                  {categoryLabel(request.category)} · {String(request.provider_type || "both").replace(/_/g, " ")}
                  {request.public_ref ? ` · Ref ${request.public_ref}` : ""}
                  {request.created_at ? ` · ${formatDateTime(request.created_at)}` : ""}
                </p>
                {request.about ? <p className="mt-2 text-sm">{request.about}</p> : null}
                <ShopRegistrationActions id={request.id} status={request.status} notes={request.admin_notes} />
              </article>
            ))}
          </div>
        )
      ) : null}
    </>
  );
}
