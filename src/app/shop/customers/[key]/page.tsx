import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { PageHeader, StatusBadge } from "@/components/ui/primitives";
import { loadShopCustomers } from "@/lib/shop/load-customers";
import { formatDateTime, money } from "@/lib/format";

export default async function ShopCustomerDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { shop } = await getOwnedShop();
  if (!shop) return null;
  const { key } = await params;
  const decoded = decodeURIComponent(key);
  const grouped = await loadShopCustomers(shop.id);
  const customer = grouped.find((row) => row.key === decoded);
  if (!customer) notFound();

  const supabase = await createServerSupabase();
  const chats = customer.customerId
    ? (
        await supabase
          .from("chat_conversations")
          .select("id, last_message_preview, last_message_at")
          .eq("shop_id", shop.id)
          .eq("customer_id", customer.customerId)
          .order("last_message_at", { ascending: false })
          .limit(8)
      ).data
    : [];

  return (
    <>
      <PageHeader title={customer.name} subtitle="Contact and history for this shop only. Other shops cannot see this record." />
      <section className="lg-card grid gap-1 p-5 text-sm">
        <p>Phone: {customer.phone || "Not on file"}</p>
        <p>Email: {customer.email || "Not on file"}</p>
        <p>
          {customer.orders} orders · {customer.sales} sales · {customer.enquiries} enquiries · {money(customer.spent)} spent
        </p>
      </section>
      <section className="mt-4">
        <h2 className="mb-2 font-semibold">Activity</h2>
        <ul className="grid gap-2">
          {customer.history.map((row) => (
            <li key={`${row.kind}-${row.id}`} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{row.title}</span>
                <span className="block text-xs text-[var(--lagecto-muted)]">{row.at ? formatDateTime(row.at) : ""}</span>
              </span>
              <span className="shrink-0 text-right">
                {row.total != null ? <span className="block">{money(row.total)}</span> : null}
                {row.status ? <StatusBadge value={row.status} /> : null}
              </span>
            </li>
          ))}
        </ul>
      </section>
      {chats?.length ? (
        <section className="mt-4">
          <h2 className="mb-2 font-semibold">Messages</h2>
          <ul className="grid gap-2">
            {chats.map((row) => (
              <li key={row.id}>
                <Link href={`/shop/chat?c=${row.id}`} className="block rounded-2xl bg-white px-3 py-2 text-sm">
                  {row.last_message_preview || "Conversation"}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
