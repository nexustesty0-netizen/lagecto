"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Award,
  Bell,
  BookOpen,
  Boxes,
  Briefcase,
  Building2,
  Calendar,
  ClipboardList,
  CreditCard,
  FileText,
  Gift,
  Globe,
  LayoutDashboard,
  LifeBuoy,
  Lock,
  LogOut,
  Megaphone,
  Menu,
  MessageCircle,
  Newspaper,
  Receipt,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { BRAND } from "@/lib/brand";
import type { Profile, UserRole } from "@/lib/types";
import { canSeeAdminLogs } from "@/lib/admin-access";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };
type NavGroup = { title: string; items: NavItem[] };

const NAV: Record<UserRole, NavGroup[]> = {
  customer: [
    {
      title: "Marketplace",
      items: [
        { href: "/customer", label: "Dashboard", icon: LayoutDashboard },
        { href: "/customer/shops", label: "Shops", icon: Store },
        { href: "/customer/saved", label: "Saved shops", icon: Award },
        { href: "/customer/smart-shop", label: "Smart shop", icon: Sparkles },
        { href: "/customer/cart", label: "Cart", icon: ShoppingCart },
        { href: "/customer/orders", label: "Orders", icon: ClipboardList },
        { href: "/customer/receipts", label: "Receipts", icon: Receipt },
        { href: "/customer/bookings", label: "Bookings", icon: Calendar },
        { href: "/customer/requests", label: "Requests", icon: Briefcase },
        { href: "/customer/chat", label: "My chats", icon: MessageCircle },
        { href: "/customer/community", label: "Community", icon: Users },
        { href: "/customer/news", label: "News", icon: Newspaper },
        { href: "/customer/promotions", label: "Promotions", icon: Megaphone },
      ],
    },
    {
      title: "Life",
      items: [
        { href: "/customer/loyalty", label: "Loyalty", icon: Gift },
        { href: "/customer/rewards", label: "Rewards", icon: Sparkles },
        { href: "/customer/badges", label: "Achievements", icon: Award },
        { href: "/customer/diary", label: "Diary", icon: BookOpen },
        { href: "/customer/notifications", label: "Notifications", icon: Bell },
        { href: "/support", label: "Help", icon: LifeBuoy },
        { href: "/customer/settings", label: "Settings", icon: Settings },
      ],
    },
    {
      title: "Stebo",
      items: [{ href: "/customer/stebo", label: "Stebo", icon: Sparkles }],
    },
  ],
  shop_owner: [
    {
      title: "Shop Management",
      items: [
        { href: "/shop", label: "Dashboard", icon: LayoutDashboard },
        { href: "/shop/products", label: "Products", icon: ShoppingBag },
        { href: "/shop/services", label: "Services", icon: Briefcase },
        { href: "/shop/categories", label: "Categories", icon: Boxes },
        { href: "/shop/inventory", label: "Inventory", icon: Boxes },
        { href: "/shop/pos", label: "POS", icon: CreditCard },
        { href: "/shop/sales", label: "Sales", icon: ClipboardList },
        { href: "/shop/quotations", label: "Quotations", icon: FileText },
        { href: "/shop/orders", label: "Orders", icon: ClipboardList },
        { href: "/shop/bookings", label: "Bookings", icon: Calendar },
        { href: "/shop/service-requests", label: "Requests", icon: MessageCircle },
        { href: "/shop/customers", label: "Customers", icon: Users },
        { href: "/shop/employees", label: "Employees", icon: Users },
        { href: "/shop/payroll", label: "Payroll", icon: Wallet },
        { href: "/shop/expenses", label: "Expenses", icon: Receipt },
        { href: "/shop/suppliers", label: "Suppliers", icon: Store },
        { href: "/shop/purchases", label: "Purchases", icon: ShoppingCart },
        { href: "/shop/financials", label: "Financials", icon: Wallet },
        { href: "/shop/payments", label: "Payments", icon: CreditCard },
        { href: "/shop/receipts", label: "Receipts", icon: Receipt },
        { href: "/shop/storefront", label: "Storefront", icon: Globe },
        { href: "/shop/settings", label: "Settings", icon: Settings },
      ],
    },
    {
      title: "Growth",
      items: [
        { href: "/shop/promotions", label: "Promotions", icon: Megaphone },
        { href: "/shop/loyalty", label: "Customer loyalty", icon: Gift },
        { href: "/shop/community", label: "Community", icon: Users },
        { href: "/shop/insights", label: "Insights", icon: Sparkles },
        { href: "/shop/reports", label: "Reports", icon: ClipboardList },
        { href: "/shop/subscription", label: "Subscription", icon: CreditCard },
        { href: "/shop/chat", label: "Messages", icon: MessageCircle },
        { href: "/shop/notifications", label: "Notifications", icon: Bell },
        { href: "/shop/news", label: "News", icon: Newspaper },
        { href: "/shop/diary", label: "Diary", icon: BookOpen },
        { href: "/shop/help", label: "Help", icon: LifeBuoy },
      ],
    },
    {
      title: "Stebo",
      items: [{ href: "/shop/stebo", label: "Stebo", icon: Sparkles }],
    },
  ],
  admin: [
    {
      title: "Platform",
      items: [
        { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
        { href: "/admin/users", label: "Manage users", icon: Users },
        { href: "/admin/shops", label: "Shops", icon: Store },
        { href: "/admin/pos", label: "POS", icon: CreditCard },
        { href: "/admin/receipts", label: "Receipts", icon: Receipt },
        { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
        { href: "/admin/payments", label: "Payments", icon: CreditCard },
        { href: "/admin/subscriptions", label: "Packages", icon: CreditCard },
        { href: "/admin/security", label: "Security", icon: Lock },
        { href: "/admin/reports", label: "Reports", icon: Wallet },
        { href: "/admin/shop-reports", label: "Shop reports", icon: ClipboardList },
        { href: "/admin/support", label: "Support Centre", icon: LifeBuoy },
        { href: "/admin/expenses", label: "Expenses", icon: Receipt },
        { href: "/admin/ads", label: "Ads", icon: Megaphone },
        { href: "/admin/loyalty", label: "Customer loyalty", icon: Gift },
        { href: "/admin/badges", label: "Badges", icon: Award },
        { href: "/admin/campaigns", label: "Campaigns", icon: Sparkles },
        { href: "/admin/promo-codes", label: "Promo codes", icon: Megaphone },
      ],
    },
    {
      title: "Content",
      items: [
        { href: "/admin/news", label: "News", icon: Newspaper },
        { href: "/admin/chat", label: "Messages", icon: MessageCircle },
        { href: "/admin/company", label: "Company", icon: Building2 },
        { href: "/admin/languages", label: "Languages", icon: Globe },
        { href: "/admin/notifications", label: "Send update", icon: Bell },
        { href: "/admin/diary", label: "Diary", icon: BookOpen },
        { href: "/admin/settings", label: "Settings", icon: Settings },
      ],
    },
    {
      title: "Stebo",
      items: [{ href: "/admin/stebo", label: "Intelligence", icon: Sparkles }],
    },
  ],
};

const MOBILE_PRIMARY: Record<UserRole, string[]> = {
  customer: ["/customer", "/customer/shops", "/customer/cart", "/customer/diary", "/customer/stebo"],
  shop_owner: ["/shop", "/shop/orders", "/shop/pos", "/shop/financials", "/shop/stebo"],
  admin: ["/admin", "/admin/shops", "/admin/pos", "/admin/users", "/admin/stebo"],
};

function shopNav(providerType?: string | null) {
  const hide = new Set<string>();
  if (providerType === "products") {
    hide.add("/shop/services");
    hide.add("/shop/bookings");
    hide.add("/shop/service-requests");
  } else if (providerType === "services") {
    hide.add("/shop/products");
    hide.add("/shop/inventory");
  }
  if (!hide.size) return NAV.shop_owner;
  return NAV.shop_owner.map((group) => ({
    ...group,
    items: group.items.filter((item) => !hide.has(item.href)),
  }));
}

function adminNav(profile: Profile) {
  if (canSeeAdminLogs(profile)) return NAV.admin;
  return NAV.admin.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.href !== "/admin/security"),
  }));
}

function flatten(groups: NavGroup[]) {
  return groups.flatMap((group) => group.items);
}

export function AppShell({
  profile,
  children,
  shopName,
  shopProviderType,
}: {
  profile: Profile;
  children: React.ReactNode;
  shopName?: string | null;
  shopProviderType?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const groups =
    profile.role === "shop_owner" ? shopNav(shopProviderType) : profile.role === "admin" ? adminNav(profile) : NAV[profile.role];
  const items = flatten(groups);
  const mobile = items.filter((item) => MOBILE_PRIMARY[profile.role].includes(item.href));
  const home = profile.role === "shop_owner" ? "/shop" : `/${profile.role}`;
  const initials = (profile.name || profile.username || profile.email || "LG")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function isActive(href: string) {
    if (pathname === href) return true;
    if (href === home) return false;
    return pathname.startsWith(href + "/") || pathname === href;
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-[var(--lagecto-border)] bg-[color-mix(in_srgb,var(--lagecto-ivory)_88%,transparent)] backdrop-blur-xl" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-3 py-2.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button type="button" className="grid h-11 w-11 place-items-center rounded-xl lg:hidden" aria-label="Open navigation" onClick={() => setOpen(true)}>
              <Menu size={20} />
            </button>
            <Link href={home} className="flex min-w-0 items-center gap-2">
              <Logo size={40} />
              <span className="truncate font-semibold tracking-tight">{BRAND.name}</span>
            </Link>
          </div>
          <div className="hidden max-w-md flex-1 px-8 lg:block">
            <label className="sr-only" htmlFor="app-search">
              Search
            </label>
            <div className="flex items-center gap-2 rounded-full border border-[var(--lagecto-border)] bg-white/80 px-3 py-2 text-sm">
              <Search size={16} className="text-[var(--lagecto-muted)]" />
              <input
                id="app-search"
                className="w-full border-0 bg-transparent px-0 py-0 shadow-none focus:shadow-none"
                placeholder="Search LaGecto"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationCenter />
            <div className="hidden items-center gap-2 sm:flex">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-[#0B6E4F] text-xs font-semibold text-white">
                {initials}
              </div>
              <div className="text-right text-sm">
                <p className="font-medium leading-tight">{profile.name || profile.username || profile.email}</p>
                <p className="text-xs text-[var(--lagecto-muted)]">
                  {shopName || profile.admin_role?.replace("_", " ") || profile.role.replace("_", " ")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px]">
        <aside className="sticky top-[61px] hidden h-[calc(100vh-61px)] w-[272px] shrink-0 overflow-y-auto p-3 lg:block">
          <nav className="lg-card grid gap-4 p-3" aria-label="Application">
            {groups.map((group) => (
              <div key={group.title}>
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--lagecto-muted)]">
                  {group.title}
                </p>
                <div className="grid gap-1">
                  {group.items.map((item) => {
                    const active = isActive(item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
                          active
                            ? "bg-[#0B6E4F] text-white shadow-[0_10px_20px_rgba(11,110,79,0.25)]"
                            : "text-[var(--lagecto-text)] hover:bg-[#0B6E4F]/8"
                        }`}
                      >
                        <Icon size={18} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={logout}
              className="mt-1 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm text-[#C2413B] hover:bg-red-50"
            >
              <LogOut size={18} />
              Log out
            </button>
          </nav>
        </aside>

        <main id="main" className="lg-page min-w-0 flex-1 px-4 py-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] lg:px-8 lg:pb-10">
          {children}
        </main>
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 bg-[#12241c]/40 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)}>
          <aside className="h-full w-[82%] max-w-sm overflow-y-auto bg-[var(--lagecto-ivory)] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <span className="font-semibold">{BRAND.name}</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close navigation">
                <X />
              </button>
            </div>
            <nav className="grid gap-4">
              {groups.map((group) => (
                <div key={group.title}>
                  <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--lagecto-muted)]">{group.title}</p>
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="block rounded-xl px-3 py-2.5 hover:bg-[#0B6E4F]/8"
                      onClick={() => setOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
          </aside>
        </div>
      ) : null}

      <nav
        className="fixed inset-x-3 z-30 mx-auto grid max-w-lg grid-cols-5 rounded-[28px] border border-[var(--lagecto-border)] bg-[color-mix(in_srgb,var(--lagecto-ivory)_92%,transparent)] px-1 py-2 shadow-[0_18px_40px_rgba(18,36,28,0.16)] backdrop-blur-xl lg:hidden"
        style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        aria-label="Mobile"
      >
        {mobile.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-2xl py-1 text-[11px] ${active ? "text-[#0B6E4F]" : "text-[var(--lagecto-muted)]"}`}
            >
              <span className={`grid h-8 w-8 place-items-center rounded-2xl ${active ? "bg-[#0B6E4F]/12" : ""}`}>
                <Icon size={18} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
