import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { DashboardHero, StatCard, EmptyState, StatusBadge } from "@/components/ui/primitives";
import { ProductGrid } from "@/components/public/ProductCard";
import { evaluateCurrentCustomer, loadCustomerLoyalty, loadCustomerBadges, loadCustomerRewards, asOne } from "@/lib/loyalty/load";
import { LoyaltyMeter } from "@/components/loyalty/LoyaltyMeter";
import { AchievementUnlock } from "@/components/loyalty/AchievementUnlock";
import { AdStrip } from "@/components/ads/AdStrip";
import { loadCustomerHome } from "@/lib/customer/home";
import { formatDateTime, money } from "@/lib/format";
import { publicDisplayName } from "@/lib/chat-privacy";

export default async function CustomerDashboard() {
  const profile = await requireRole("customer");
  const [home, evaluated, loyalty, badges, rewards] = await Promise.all([
    loadCustomerHome(profile.id),
    evaluateCurrentCustomer(),
    loadCustomerLoyalty(profile.id),
    loadCustomerBadges(profile.id),
    loadCustomerRewards(profile.id),
  ]);
  const level = asOne(loyalty.platformWallet?.loyalty_levels as { name?: string; rank?: number } | { name?: string; rank?: number }[] | null);
  const next = loyalty.levels.find((row) => row.rank === Number(level?.rank || 1) + 1);
  const firstName = publicDisplayName(profile.name?.split(" ")[0], "");

  return (
    <>
      <DashboardHero
        kicker="Your shopping"
        title={firstName ? `Hi, ${firstName}` : "Your shopping"}
        subtitle="Orders, enquiries and saved shops for this account only."
        image="/marketplace/shops-hero.png"
        action={
          <Link href="/marketplace" className="inline-flex min-h-11 items-center rounded-full bg-white px-5 text-sm font-semibold text-[#0B6E4F]">
            Browse marketplace
          </Link>
        }
      />
      <AchievementUnlock items={evaluated?.newly_unlocked || []} />
      <div className="mb-5 sm:mb-8">
        <LoyaltyMeter
          levelName={level?.name || "Newcomer"}
          points={Number(loyalty.platformWallet?.lifetime_points || 0)}
          nextName={next?.name}
          nextPoints={next?.min_points}
          unlocked={badges.earned.length}
          totalBadges={badges.defs.length || 100}
          rewardsReady={Math.max(rewards.rewards.length - rewards.claims.length, 0)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
        <StatCard label="Orders" value={String(home.orderCount)} />
        <StatCard label="Open enquiries" value={String(home.enquiries.length)} />
        <StatCard label="Unread messages" value={String(home.unreadMessages)} />
        <StatCard label="Wishlist" value={String(home.wishlist.length)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="lg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Recent orders</h2>
            <Link href="/customer/orders" className="text-sm font-medium text-[#0B6E4F]">
              All
            </Link>
          </div>
          {!home.orders.length ? (
            <p className="text-sm text-[var(--lagecto-muted)]">Checkout from your cart via WhatsApp. Pending orders appear here.</p>
          ) : (
            <ul className="grid gap-2">
              {home.orders.map((order) => (
                <li key={order.id}>
                  <Link href={`/customer/orders/${order.id}`} className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-[#F7F3E8]">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{order.orderNumber}</span>
                      <span className="block truncate text-xs text-[var(--lagecto-muted)]">
                        {order.shopName} · {formatDateTime(order.createdAt)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-semibold">{money(order.total)}</span>
                      <StatusBadge value={order.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Open enquiries</h2>
            <Link href="/customer/requests" className="text-sm font-medium text-[#0B6E4F]">
              All
            </Link>
          </div>
          {!home.enquiries.length ? (
            <p className="text-sm text-[var(--lagecto-muted)]">Send a request from a shop page, or message a shop about a product.</p>
          ) : (
            <ul className="grid gap-2">
              {home.enquiries.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 rounded-xl px-2 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{row.title}</span>
                    <span className="block truncate text-xs text-[var(--lagecto-muted)]">{row.shopName}</span>
                  </span>
                  <StatusBadge value={row.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="lg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Messages</h2>
            <Link href="/customer/chat" className="text-sm font-medium text-[#0B6E4F]">
              Inbox
            </Link>
          </div>
          {home.unreadNotes ? (
            <p className="mb-3 text-sm text-[var(--lagecto-muted)]">{home.unreadNotes} unread notification{home.unreadNotes === 1 ? "" : "s"}.</p>
          ) : null}
          {!home.recentChats.length ? (
            <p className="text-sm text-[var(--lagecto-muted)]">Message a shop from its page or a product listing.</p>
          ) : (
            <ul className="grid gap-2">
              {home.recentChats.map((row) => (
                <li key={row.id}>
                  <Link href={`/customer/chat?c=${row.id}`} className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-[#F7F3E8]">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{row.peer_name}</span>
                      <span className="block truncate text-xs text-[var(--lagecto-muted)]">{row.last_message_preview || "No messages yet"}</span>
                    </span>
                    {row.unread ? (
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#0B6E4F] px-1 text-[11px] text-white">
                        {row.unread > 9 ? "9+" : row.unread}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Wishlist</h2>
            <Link href="/customer/saved" className="text-sm font-medium text-[#0B6E4F]">
              Saved shops
            </Link>
          </div>
          {!home.wishlist.length ? (
            <p className="text-sm text-[var(--lagecto-muted)]">Save a shop from its page to find it again here.</p>
          ) : (
            <ul className="grid gap-2">
              {home.wishlist.map((shop) => (
                <li key={shop.id}>
                  <Link href={shop.href} className="block rounded-xl px-2 py-2 hover:bg-[#F7F3E8]">
                    <span className="block font-medium">{shop.name}</span>
                    <span className="block text-xs text-[var(--lagecto-muted)]">{shop.category}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {home.viewed.length ? (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold sm:text-lg">Recently viewed</h2>
            <Link href="/customer/recent" className="text-sm font-medium text-[#0B6E4F]">
              All
            </Link>
          </div>
          <ProductGrid products={home.viewed} />
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold sm:text-lg">Suggested for you</h2>
        {!home.recommended.length ? (
          <EmptyState
            title="Nothing to suggest yet"
            body="Browse the marketplace so LaGecto can show products from shops you actually look at."
            action={
              <Link href="/marketplace" className="lg-btn">
                Browse marketplace
              </Link>
            }
          />
        ) : (
          <ProductGrid products={home.recommended} />
        )}
      </section>

      <AdStrip className="mt-6 sm:mt-8" />
    </>
  );
}
