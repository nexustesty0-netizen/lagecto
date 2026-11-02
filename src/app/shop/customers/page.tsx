import Link from "next/link";
import { getOwnedShop } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { loadShopCustomers } from "@/lib/shop/load-customers";
import { formatDateTime, money } from "@/lib/format";

export default async function ShopCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { shop } = await getOwnedShop();
  if (!shop) return null;
  const { q } = await searchParams;
  const grouped = await loadShopCustomers(shop.id);
  const needle = String(q || "").trim().toLowerCase();
  const rows = grouped.filter((row) => {
    if (!needle) return true;
    return `${row.name} ${row.phone || ""}`.toLowerCase().includes(needle);
  });

  return (
    <>
      <PageHeader title="Customers" subtitle="People who ordered, bought, or sent an enquiry to this shop. Email stays on the customer record, not this list." />
      <form className="mb-4">
        <input name="q" defaultValue={q} placeholder="Search name or phone" className="w-full max-w-md rounded-xl border px-3 py-2" />
      </form>
      {!rows.length ? (
        <EmptyState
          title="No customers yet"
          body="Customers appear after they place an order, send an enquiry, or you complete a POS sale with their name."
          action={
            <Link href="/shop/pos" className="inline-flex rounded-full bg-[#0B6E4F] px-4 py-2 text-sm font-semibold text-white">
              Record a sale
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-2 md:hidden">
            {rows.map((row) => (
              <Link key={row.key} href={`/shop/customers/${encodeURIComponent(row.key)}`} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--lagecto-border)] bg-white p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{row.name}</p>
                  <p className="text-xs text-[var(--lagecto-muted)]">
                    {row.orders} orders · {row.sales} sales
                  </p>
                </div>
                <p className="text-sm font-semibold text-[#0B6E4F]">{money(row.spent)}</p>
              </Link>
            ))}
          </div>
          <div className="app-table-wrap hidden md:block">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Orders</th>
                  <th>Sales</th>
                  <th>Enquiries</th>
                  <th>Spent</th>
                  <th>Last</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <Link href={`/shop/customers/${encodeURIComponent(row.key)}`} className="font-medium text-[#0B6E4F]">
                        {row.name}
                      </Link>
                    </td>
                    <td>{row.phone || "—"}</td>
                    <td>{row.orders}</td>
                    <td>{row.sales}</td>
                    <td>{row.enquiries}</td>
                    <td>{money(row.spent)}</td>
                    <td>{row.lastAt ? formatDateTime(row.lastAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
