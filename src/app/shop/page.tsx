import Link from "next/link";
import {
  Boxes,
  ClipboardList,
  CreditCard,
  MessageCircle,
  ShoppingBag,
  Users,
} from "lucide-react";
import { loadOwnedShopWithFeatures } from "@/lib/entitlements";
import { getShopDashboardStats, type DashboardPeriod } from "@/lib/shop/dashboard-stats";
import { loadShopHome } from "@/lib/shop/home";
import { DashboardHero, PeriodChips, StatCard, EmptyState, StatusBadge } from "@/components/ui/primitives";
import { ShopStatusCard } from "@/components/shop/ShopStatusCard";
import { SalesTrendChart } from "@/components/shop/SalesTrendChart";
import { AppShortcut } from "@/components/shop/AppShortcut";
import { formatDateTime, money } from "@/lib/format";
import { PACKAGE_META } from "@/lib/packages";
import { staffIsOwner, staffPathAllowed } from "@/lib/shop/staff";

const PERIODS: Array<[string, string]> = [
  ["current", "Current"],
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["week", "Week"],
  ["last_week", "Last week"],
  ["month", "Month"],
  ["last_month", "Last month"],
  ["year", "Year"],
];

const SHORTCUTS = [
  { href: "/shop/pos", label: "POS", icon: <CreditCard size={14} /> },
  { href: "/shop/orders", label: "Orders", icon: <ClipboardList size={14} /> },
  { href: "/shop/products", label: "Products", icon: <ShoppingBag size={14} /> },
  { href: "/shop/inventory", label: "Stock", icon: <Boxes size={14} /> },
  { href: "/shop/customers", label: "Customers", icon: <Users size={14} /> },
  { href: "/shop/chat", label: "Messages", icon: <MessageCircle size={14} /> },
];

export default async function ShopDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const { shop, profile, subscription, staffRole } = await loadOwnedShopWithFeatures();
  if (!shop) return null;
  const { period, from, to } = await searchParams;
  const selected = (period as DashboardPeriod) || "current";
  const [stats, home] = await Promise.all([
    getShopDashboardStats(shop.id, { period: selected, from, to }),
    loadShopHome(shop.id, profile.id),
  ]);
  const plan = PACKAGE_META[subscription.packageKey]?.name || "Free";
  const shortcuts = SHORTCUTS.filter((item) => {
    if (!staffPathAllowed(staffRole, item.href)) return false;
    if (shop.provider_type === "services" && (item.href === "/shop/products" || item.href === "/shop/inventory")) return false;
    return true;
  });
  const canSales = staffPathAllowed(staffRole, "/shop/sales");
  const canChat = staffPathAllowed(staffRole, "/shop/chat");
  const canInventory = staffPathAllowed(staffRole, "/shop/inventory") && shop.provider_type !== "services";
  const canRequests = staffPathAllowed(staffRole, "/shop/service-requests") && shop.provider_type !== "products";

  return (
    <>
      <DashboardHero
        kicker={plan}
        title={shop.name}
        subtitle="Sales, stock and orders for this shop only."
        image={shop.banner_url || "/visuals/login-hero.png"}
      />
      <PeriodChips selected={selected} options={PERIODS} hrefFor={(value) => (value === "current" ? "/shop" : `/shop?period=${value}`)} />
      {!stats ? (
        <EmptyState title="No financial period" body="A period is created automatically when the shop is created." />
      ) : (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard tone="dark" label="Sales" value={money(stats.revenue)} hint={selected === "current" ? "Completed sales this period" : "Completed sales in this range"} />
          <StatCard tone={stats.result === "loss" ? "gold" : "green"} label="Result" value={money(stats.profit)} hint={stats.calculation_label} />
          <StatCard label="Products" value={String(stats.products)} />
          <StatCard label="Pending orders" value={String(home.pendingOrderCount || stats.pending_orders)} hint="WhatsApp checkouts waiting for confirmation" />
        </div>
      )}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Low stock" value={String(home.lowStock.length || stats?.low_stock || 0)} />
        <StatCard label="Out of stock" value={String(home.outOfStock)} />
        <StatCard label="Open enquiries" value={String(home.enquiries.length)} />
        <StatCard label="Unread messages" value={String(home.unreadMessages)} />
      </div>
      <div className="mb-4">
        <SalesTrendChart series={home.series} />
      </div>
      {shortcuts.length ? (
        <section className="lg-card mb-4 p-2">
          <p className="px-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--lagecto-muted)]">Shortcuts</p>
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-6">
            {shortcuts.map((item) => (
              <AppShortcut key={item.href} href={item.href} label={item.label} icon={item.icon} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="lg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--lagecto-muted)]">Recent sales</p>
            {canSales ? (
              <Link href="/shop/sales" className="text-xs font-semibold text-[#0B6E4F]">
                All
              </Link>
            ) : null}
          </div>
          <ul className="mt-3 grid gap-2">
            {home.recentSales.map((sale) => (
              <li key={sale.id} className="flex items-center justify-between gap-3 rounded-2xl bg-[#F7F3E8] px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">{sale.number}</span>
                  {sale.date ? <span className="block text-[11px] text-[var(--lagecto-muted)]">{formatDateTime(sale.date)}</span> : null}
                </span>
                <span className="shrink-0 font-medium">{money(sale.total)}</span>
              </li>
            ))}
            {!home.recentSales.length ? <li className="text-sm text-[var(--lagecto-muted)]">No completed sales yet.</li> : null}
          </ul>
        </section>

        <section className="lg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--lagecto-muted)]">Pending orders</p>
            <Link href="/shop/orders" className="text-xs font-semibold text-[#0B6E4F]">
              All
            </Link>
          </div>
          <ul className="mt-3 grid gap-2">
            {home.pendingOrders.map((order) => (
              <li key={order.id} className="flex items-center justify-between gap-3 rounded-2xl bg-[#F7F3E8] px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">{order.number}</span>
                  <span className="block truncate text-[11px] text-[var(--lagecto-muted)]">{order.customerName}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-medium">{money(order.total)}</span>
                  <StatusBadge value={order.status} />
                </span>
              </li>
            ))}
            {!home.pendingOrders.length ? (
              <li className="text-sm text-[var(--lagecto-muted)]">No pending WhatsApp checkouts.</li>
            ) : null}
          </ul>
        </section>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <section className="lg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--lagecto-muted)]">Best sellers</p>
            {canSales ? (
              <Link href="/shop/sales" className="text-xs font-semibold text-[#0B6E4F]">
                Sales
              </Link>
            ) : null}
          </div>
          <ul className="mt-3 grid gap-2">
            {home.bestSellers.map((item) => (
              <li key={item.id || item.name} className="flex items-center justify-between gap-3 rounded-2xl bg-[#F7F3E8] px-3 py-2 text-sm">
                <span className="truncate">{item.name}</span>
                <span className="shrink-0 text-[var(--lagecto-muted)]">{item.quantity} sold</span>
              </li>
            ))}
            {!home.bestSellers.length ? (
              <li className="text-sm text-[var(--lagecto-muted)]">Best sellers appear after completed POS or order sales.</li>
            ) : null}
          </ul>
        </section>

        {canChat ? (
        <section className="lg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--lagecto-muted)]">Messages</p>
            <Link href="/shop/chat" className="text-xs font-semibold text-[#0B6E4F]">
              Inbox
            </Link>
          </div>
          <ul className="mt-3 grid gap-2">
            {home.recentChats.map((row) => (
              <li key={row.id}>
                <Link href={`/shop/chat?c=${row.id}`} className="flex items-center justify-between gap-3 rounded-2xl px-1 py-1 hover:bg-[#F7F3E8]">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{row.peer_name}</span>
                    <span className="block truncate text-[11px] text-[var(--lagecto-muted)]">{row.last_message_preview || "No messages yet"}</span>
                  </span>
                  {row.unread ? (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#0B6E4F] px-1 text-[11px] text-white">
                      {row.unread > 9 ? "9+" : row.unread}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
            {!home.recentChats.length ? (
              <li className="text-sm text-[var(--lagecto-muted)]">Customer messages for this shop appear here.</li>
            ) : null}
          </ul>
        </section>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {canInventory ? (
        <section className="lg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--lagecto-muted)]">Stock alerts</p>
            <Link href="/shop/inventory" className="text-xs font-semibold text-[#0B6E4F]">
              Inventory
            </Link>
          </div>
          <ul className="mt-3 grid gap-2">
            {home.lowStock.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 rounded-2xl bg-[#F7F3E8] px-3 py-2 text-sm">
                <span className="truncate">{row.name}</span>
                <span className="shrink-0 text-[var(--lagecto-muted)]">{row.stock} left</span>
              </li>
            ))}
            {!home.lowStock.length ? (
              <li className="text-sm text-[var(--lagecto-muted)]">
                {home.outOfStock ? `${home.outOfStock} product${home.outOfStock === 1 ? "" : "s"} at zero stock.` : "No low-stock products right now."}
              </li>
            ) : null}
          </ul>
        </section>
        ) : null}

        {canRequests ? (
        <section className="lg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--lagecto-muted)]">Enquiries</p>
            <Link href="/shop/service-requests" className="text-xs font-semibold text-[#0B6E4F]">
              All
            </Link>
          </div>
          <ul className="mt-3 grid gap-2">
            {home.enquiries.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 rounded-2xl bg-[#F7F3E8] px-3 py-2 text-sm">
                <span className="truncate">{row.title}</span>
                <StatusBadge value={row.status} />
              </li>
            ))}
            {!home.enquiries.length ? <li className="text-sm text-[var(--lagecto-muted)]">No open customer requests.</li> : null}
          </ul>
          {home.activity.length ? (
            <ul className="mt-3 grid gap-1 border-t border-[var(--lagecto-border)] pt-3">
              {home.activity.map((note) => (
                <li key={note.id} className="text-xs text-[var(--lagecto-muted)]">
                  {note.title}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
        ) : null}
      </div>

      {staffIsOwner(staffRole) ? (
        <div className="mt-3">
          <ShopStatusCard subscription={subscription} />
        </div>
      ) : null}
    </>
  );
}
