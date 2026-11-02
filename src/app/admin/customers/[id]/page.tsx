import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, StatusBadge } from "@/components/ui/primitives";
import { CustomerRestrictForm } from "@/components/admin/CustomerDesk";
import { canRestrictAccounts, canViewAccountContact } from "@/lib/admin-access";
import { publicDisplayName } from "@/lib/chat-privacy";
import { formatDateTime, money } from "@/lib/format";

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole("admin");
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: customer } = await supabase
    .from("users")
    .select("id, name, email, username, account_status, created_at, last_login_at, role")
    .eq("id", id)
    .eq("role", "customer")
    .maybeSingle();
  if (!customer) notFound();
  const seeContact = canViewAccountContact(profile);
  const [{ data: orders }, { count: orderCount }] = await Promise.all([
    supabase.from("orders").select("id, order_number, total, status, created_at, shops(name)").eq("customer_id", customer.id).order("created_at", { ascending: false }).limit(8),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("customer_id", customer.id),
  ]);

  return (
    <>
      <PageHeader
        title={publicDisplayName(customer.name || customer.username, "Customer")}
        subtitle={customer.username ? `@${customer.username}` : "Customer account"}
        action={
          <Link href="/admin/customers" className="rounded-full border px-4 py-2 text-sm">
            All customers
          </Link>
        }
      />
      <div className="os-surface mb-6 grid gap-2 text-sm">
        <p>
          Status <StatusBadge value={customer.account_status} />
        </p>
        {seeContact && customer.email ? <p>Email {customer.email}</p> : null}
        <p>Joined {formatDateTime(customer.created_at)}</p>
        <p>Last sign-in {formatDateTime(customer.last_login_at)}</p>
        <p>Orders {orderCount || 0}</p>
      </div>
      <section className="os-surface">
        <h2 className="font-semibold">Recent orders</h2>
        <ul className="mt-3 grid gap-2 text-sm">
          {(orders || []).map((row) => (
            <li key={row.id} className="flex justify-between gap-3">
              <span>
                {row.order_number} · {(row.shops as { name?: string } | null)?.name || "Shop"}
              </span>
              <span>
                {money(row.total)} · {row.status}
              </span>
            </li>
          ))}
          {!orders?.length ? <li className="text-[var(--lagecto-muted)]">No orders yet.</li> : null}
        </ul>
      </section>
      {canRestrictAccounts(profile) ? <CustomerRestrictForm userId={customer.id} status={customer.account_status} /> : null}
    </>
  );
}
