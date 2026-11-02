"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Award,
  BadgeCheck,
  Banknote,
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  ChevronDown,
  ClipboardList,
  CreditCard,
  Eye,
  FileText,
  Gift,
  Globe,
  Heart,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  LineChart,
  Lock,
  LogOut,
  Megaphone,
  Menu,
  MessageCircle,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  Tag,
  Tags,
  Truck,
  UserCog,
  Users,
  UsersRound,
  Wallet,
  Warehouse,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { BRAND } from "@/lib/brand";
import type { Profile } from "@/lib/types";
import { adminPathAllowed, adminRoleLabel, effectiveAdminRole } from "@/lib/admin-access";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { staffHome, staffPathAllowed, staffRoleLabel, type ShopStaffRole } from "@/lib/shop/staff";
import {
  adminNav,
  customerNav,
  filterNavByHref,
  filterShopNav,
  flattenNav,
  groupStartsOpen,
  headerSearchPath,
  isNavActive,
  mobilePrimaryHrefs,
  shopNav,
  shopNavLock,
  type NavGroupDef,
  type NavIconKey,
  type NavItemDef,
} from "@/lib/app-nav";
import { NAV_BADGES_EVENT, type NavBadgeCounts } from "@/lib/notifications-events";

const ICONS: Record<NavIconKey, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  wallet: Wallet,
  products: ShoppingBag,
  categories: Tags,
  inventory: Warehouse,
  services: Briefcase,
  pos: CreditCard,
  sales: Banknote,
  orders: ClipboardList,
  customers: Users,
  messages: MessageCircle,
  promotions: Megaphone,
  reports: BarChart3,
  analytics: LineChart,
  employees: UserCog,
  subscription: BadgeCheck,
  settings: Settings,
  help: LifeBuoy,
  quotations: FileText,
  bookings: Calendar,
  enquiries: Inbox,
  payroll: Banknote,
  expenses: Receipt,
  suppliers: Truck,
  purchases: ShoppingCart,
  payments: CreditCard,
  receipts: Receipt,
  storefront: Globe,
  loyalty: Gift,
  community: UsersRound,
  notifications: Bell,
  news: Newspaper,
  diary: BookOpen,
  stebo: Sparkles,
  marketplace: Store,
  cart: ShoppingCart,
  wishlist: Heart,
  recent: Eye,
  verification: BadgeCheck,
  shops: Store,
  badge: BadgeCheck,
  lock: Lock,
  building: Building2,
  globe: Globe,
  tag: Tag,
  ads: Megaphone,
  campaigns: Sparkles,
  award: Award,
  file: FileText,
};

function groupsFor(profile: Profile, shopProviderType?: string | null, staffRole?: ShopStaffRole | null) {
  if (profile.role === "admin") return filterNavByHref(adminNav(), (href) => adminPathAllowed(profile, href));
  if (profile.role === "shop_owner" || staffRole) {
    const role = staffRole || (profile.role === "shop_owner" ? "owner" : null);
    return filterShopNav(shopNav(), {
      providerType: shopProviderType,
      allowed: (href) => staffPathAllowed(role, href),
    });
  }
  return customerNav();
}

function badgeCount(item: NavItemDef, badges: NavBadgeCounts) {
  if (item.badge === "messages") return badges.unreadMessages;
  if (item.badge === "notifications") return badges.unread;
  return 0;
}

function NavMenu({
  groups,
  home,
  pathname,
  collapsed,
  badges,
  lockedFor,
  onNavigate,
  onLogout,
}: {
  groups: NavGroupDef[];
  home: string;
  pathname: string;
  collapsed: boolean;
  badges: NavBadgeCounts;
  lockedFor?: (href: string) => string | null;
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  return (
    <nav className="app-nav flex min-h-0 flex-1 flex-col" aria-label="Application">
      <div className="app-nav-scroll min-h-0 flex-1 overflow-y-auto pr-1">
        {groups.map((group) => {
          const startsOpen = groupStartsOpen(group, pathname, home);
          const expanded = openGroups[group.title] ?? startsOpen;
          const showItems = collapsed ? startsOpen : expanded;
          if (collapsed && !showItems) return null;
          return (
            <div key={group.title} className="mb-3">
              {collapsed ? (
                <div className="mx-auto mb-1 h-px w-6 bg-white/15" aria-hidden />
              ) : (
                <button
                  type="button"
                  className="mb-1 flex w-full items-center justify-between px-3 py-1 text-left"
                  aria-expanded={expanded}
                  onClick={() =>
                    setOpenGroups((current) => ({
                      ...current,
                      [group.title]: !(current[group.title] ?? groupStartsOpen(group, pathname, home)),
                    }))
                  }
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#FFB000]">{group.title}</span>
                  <ChevronDown size={14} className={`text-white/50 transition ${expanded ? "rotate-0" : "-rotate-90"}`} />
                </button>
              )}
              {showItems ? (
                <div className="grid gap-0.5">
                  {group.items.map((item) => {
                    const active = isNavActive(pathname, item.href, home);
                    const Icon = ICONS[item.icon];
                    const count = badgeCount(item, badges);
                    const locked = lockedFor?.(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={collapsed ? item.label : locked ? `${item.label} is limited on this plan` : item.label}
                        onClick={onNavigate}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                          collapsed ? "justify-center px-0" : ""
                        } ${active ? "bg-[#FFB000] text-[#12241c] shadow-[0_8px_18px_rgba(255,176,0,0.28)]" : "text-white/88 hover:bg-white/10"}`}
                      >
                        <span className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-lg ${active ? "bg-white/30" : "bg-white/10"}`}>
                          <Icon size={16} />
                          {collapsed && count ? (
                            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#C2413B]" />
                          ) : null}
                        </span>
                        {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
                        {!collapsed && locked ? <Lock size={12} className="ml-auto shrink-0 opacity-70" aria-label="Limited on this plan" /> : null}
                        {!collapsed && !locked && count ? (
                          <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-[#C2413B] px-1 text-[10px] font-semibold text-white">
                            {count > 9 ? "9+" : count}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onLogout}
        title="Log out"
        className={`mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[#FFB4AE] hover:bg-white/10 ${collapsed ? "justify-center px-0" : ""}`}
      >
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10">
          <LogOut size={16} />
        </span>
        {collapsed ? <span className="sr-only">Log out</span> : "Log out"}
      </button>
    </nav>
  );
}

export function AppShell({
  profile,
  children,
  shopName,
  shopProviderType,
  staffRole,
  shopFeatures,
  shopDisabledFeatures,
}: {
  profile: Profile;
  children: React.ReactNode;
  shopName?: string | null;
  shopProviderType?: string | null;
  staffRole?: ShopStaffRole | null;
  shopFeatures?: string[];
  shopDisabledFeatures?: string[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [badges, setBadges] = useState<NavBadgeCounts>({ unread: 0, unreadMessages: 0 });
  const shopAccess = profile.role === "shop_owner" || Boolean(staffRole);
  const groups = useMemo(
    () => groupsFor(profile, shopProviderType, staffRole),
    [profile, shopProviderType, staffRole],
  );
  const items = flattenNav(groups);
  const area: "customer" | "shop_owner" | "admin" = shopAccess ? "shop_owner" : profile.role === "admin" ? "admin" : "customer";
  const mobileKeys = mobilePrimaryHrefs(area, staffRole || (profile.role === "shop_owner" ? "owner" : null));
  const mobile = items.filter((item) => mobileKeys.includes(item.href));
  const home = shopAccess ? staffHome(staffRole || "owner") : `/${profile.role}`;
  const search = headerSearchPath(area);
  const roleLabel =
    staffRole && staffRole !== "owner"
      ? `${staffRoleLabel(staffRole)}${shopName ? ` · ${shopName}` : ""}`
      : shopName || (profile.role === "admin" ? adminRoleLabel(effectiveAdminRole(profile)) : profile.role.replace("_", " "));
  const initials = (profile.name || profile.username || "LG")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    setCollapsed(window.localStorage.getItem("lg-sidebar-collapsed") === "1");
    function onBadges(event: Event) {
      const detail = (event as CustomEvent<NavBadgeCounts>).detail;
      if (detail) setBadges({ unread: Number(detail.unread || 0), unreadMessages: Number(detail.unreadMessages || 0) });
    }
    window.addEventListener(NAV_BADGES_EVENT, onBadges);
    return () => window.removeEventListener(NAV_BADGES_EVENT, onBadges);
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("lg-sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }

  async function logout() {
    try {
      const { createBrowserSupabase } = await import("@/lib/supabase/browser");
      await createBrowserSupabase().auth.signOut({ scope: "local" });
    } catch {
      // Continue with the server logout even if the browser client is unavailable.
    }
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include", cache: "no-store" });
    } catch {
      // Still leave the app so a leftover session cannot bounce them back in.
    }
    window.location.assign("/login?logged_out=1");
  }

  const lockedFor = shopAccess
    ? (href: string) => shopNavLock(href, shopFeatures, shopDisabledFeatures)
    : undefined;

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-[var(--lagecto-border)] bg-[var(--lagecto-ivory)]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
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
          <form action={search.action} method="get" className="hidden max-w-md flex-1 px-8 lg:block">
            <label className="sr-only" htmlFor="app-search">
              {search.placeholder}
            </label>
            <div className="flex items-center gap-2 rounded-full border border-[var(--lagecto-border)] bg-white/80 px-3 py-2 text-sm">
              <Search size={16} className="text-[var(--lagecto-muted)]" />
              <input
                id="app-search"
                name="q"
                className="w-full border-0 bg-transparent px-0 py-0 shadow-none focus:shadow-none"
                placeholder={search.placeholder}
              />
            </div>
          </form>
          <div className="flex items-center gap-2">
            <NotificationCenter />
            <button
              type="button"
              onClick={() => void logout()}
              className="grid h-11 w-11 place-items-center rounded-xl text-[#C2413B] lg:hidden"
              aria-label="Log out"
            >
              <LogOut size={18} />
            </button>
            <div className="hidden items-center gap-2 sm:flex">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-[#0B6E4F] text-xs font-semibold text-white">
                {initials}
              </div>
              <div className="text-right text-sm">
                <p className="font-medium leading-tight">{profile.name || profile.username || "Account"}</p>
                <p className="text-xs capitalize text-[var(--lagecto-muted)]">{roleLabel}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px]">
        <aside className={`sticky top-[61px] hidden h-[calc(100vh-61px)] shrink-0 p-3 lg:flex ${collapsed ? "w-[88px]" : "w-[288px]"}`}>
          <div className="app-sidebar flex h-full w-full flex-col overflow-hidden p-3">
            <div className={`mb-3 flex items-center gap-3 rounded-2xl bg-white/10 px-3 py-3 ${collapsed ? "justify-center px-2" : ""}`}>
              <div className="grid h-10 w-10 place-items-center rounded-full bg-[#FFB000] text-xs font-semibold text-[#12241c]">
                {initials}
              </div>
              {collapsed ? null : (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{profile.name || profile.username || "Account"}</p>
                  <p className="truncate text-[11px] capitalize text-[#FFB000]">{roleLabel}</p>
                </div>
              )}
            </div>
            <NavMenu
              groups={groups}
              home={home}
              pathname={pathname}
              collapsed={collapsed}
              badges={badges}
              lockedFor={lockedFor}
              onLogout={() => void logout()}
            />
            <button
              type="button"
              onClick={toggleCollapsed}
              className="mt-2 flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs text-white/70 hover:bg-white/10"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
              {collapsed ? null : "Collapse"}
            </button>
          </div>
        </aside>

        <main id="main" className="lg-page min-w-0 flex-1 px-4 py-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] lg:px-8 lg:pb-10">
          {children}
        </main>
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 bg-[#12241c]/50 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)}>
          <aside className="app-sidebar flex h-full w-[86%] max-w-sm flex-col overflow-hidden p-4" onClick={(e) => e.stopPropagation()} style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Logo size={36} />
                <span className="font-semibold text-white">{BRAND.name}</span>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close navigation" className="grid h-10 w-10 place-items-center rounded-xl text-white">
                <X />
              </button>
            </div>
            <div className="mb-4 flex items-center gap-3 rounded-2xl bg-white/10 px-3 py-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-[#FFB000] text-xs font-semibold text-[#12241c]">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{profile.name || profile.username || "Account"}</p>
                <p className="truncate text-[11px] capitalize text-[#FFB000]">{roleLabel}</p>
              </div>
            </div>
            <NavMenu
              groups={groups}
              home={home}
              pathname={pathname}
              collapsed={false}
              badges={badges}
              lockedFor={lockedFor}
              onNavigate={() => setOpen(false)}
              onLogout={() => void logout()}
            />
          </aside>
        </div>
      ) : null}

      {mobile.length ? (
        <nav
          className="fixed inset-x-3 z-30 mx-auto grid max-w-lg gap-1 rounded-[var(--lg-radius)] border border-[var(--lagecto-border)] bg-[var(--lagecto-ivory)] px-1.5 py-1.5 lg:hidden"
          style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))", gridTemplateColumns: `repeat(${mobile.length}, minmax(0, 1fr))` }}
          aria-label="Mobile"
        >
          {mobile.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isNavActive(pathname, item.href, home);
            const count = badgeCount(item, badges);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl py-1 text-[10px] font-medium ${active ? "bg-[#0B6E4F] text-white" : "text-[var(--lagecto-muted)]"}`}
              >
                <Icon size={18} />
                {item.shortLabel || item.label}
                {count ? (
                  <span className="absolute right-2 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#C2413B] px-1 text-[9px] font-semibold text-white">
                    {count > 9 ? "9+" : count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
