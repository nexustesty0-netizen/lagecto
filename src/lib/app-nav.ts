export type NavIconKey =
  | "dashboard"
  | "wallet"
  | "products"
  | "categories"
  | "inventory"
  | "services"
  | "pos"
  | "sales"
  | "orders"
  | "customers"
  | "messages"
  | "promotions"
  | "reports"
  | "analytics"
  | "employees"
  | "subscription"
  | "settings"
  | "help"
  | "quotations"
  | "bookings"
  | "enquiries"
  | "payroll"
  | "expenses"
  | "suppliers"
  | "purchases"
  | "payments"
  | "receipts"
  | "storefront"
  | "loyalty"
  | "community"
  | "notifications"
  | "news"
  | "diary"
  | "stebo"
  | "marketplace"
  | "cart"
  | "wishlist"
  | "recent"
  | "verification"
  | "shops"
  | "badge"
  | "lock"
  | "building"
  | "globe"
  | "tag"
  | "ads"
  | "campaigns"
  | "award"
  | "file";

export type NavBadgeKey = "messages" | "notifications";

export type NavItemDef = {
  href: string;
  label: string;
  shortLabel?: string;
  icon: NavIconKey;
  badge?: NavBadgeKey;
};

export type NavGroupDef = { title: string; items: NavItemDef[]; defaultOpen?: boolean };

const PRODUCTS_ONLY_HIDE = new Set(["/shop/services", "/shop/bookings", "/shop/service-requests"]);
const SERVICES_ONLY_HIDE = new Set(["/shop/products", "/shop/inventory"]);

export const SHOP_NAV_FEATURES: Record<string, string> = {
  "/shop/products": "product_listings",
  "/shop/categories": "product_listings",
  "/shop/services": "product_listings",
  "/shop/inventory": "inventory",
  "/shop/pos": "pos",
  "/shop/promotions": "promotions",
  "/shop/orders": "order_management",
  "/shop/quotations": "quotations",
  "/shop/storefront": "digital_storefront",
  "/shop/settings": "settings",
  "/shop/employees": "employees",
  "/shop/chat": "customer_chat",
  "/shop/expenses": "expenses",
  "/shop/payroll": "payroll",
  "/shop/insights": "analytics",
  "/shop/reports": "reports_standard",
  "/shop/diary": "smart_diary_limited",
  "/shop/receipts": "receipts",
  "/shop/financials": "profit_loss",
};

export function customerNav(): NavGroupDef[] {
  return [
    {
      title: "Overview",
      items: [{ href: "/customer", label: "Overview", icon: "dashboard" }],
    },
    {
      title: "Shop",
      items: [
        { href: "/customer/shops", label: "Marketplace", shortLabel: "Shops", icon: "marketplace" },
        { href: "/customer/cart", label: "Cart", icon: "cart" },
        { href: "/customer/saved", label: "Wishlist", icon: "wishlist" },
        { href: "/customer/recent", label: "Recently viewed", shortLabel: "Recent", icon: "recent" },
      ],
    },
    {
      title: "Activity",
      items: [
        { href: "/customer/requests", label: "My enquiries", shortLabel: "Enquiries", icon: "enquiries" },
        { href: "/customer/orders", label: "Orders", icon: "orders" },
        { href: "/customer/chat", label: "Messages", icon: "messages", badge: "messages" },
      ],
    },
    {
      title: "Account",
      items: [
        { href: "/customer/notifications", label: "Notifications", icon: "notifications", badge: "notifications" },
        { href: "/customer/settings", label: "Settings", icon: "settings" },
        { href: "/support", label: "Help", icon: "help" },
      ],
    },
    {
      title: "More",
      defaultOpen: false,
      items: [
        { href: "/customer/receipts", label: "Receipts", icon: "receipts" },
        { href: "/customer/bookings", label: "Bookings", icon: "bookings" },
        { href: "/customer/loyalty", label: "Loyalty", icon: "loyalty" },
        { href: "/customer/rewards", label: "Rewards", icon: "stebo" },
        { href: "/customer/badges", label: "Achievements", icon: "award" },
        { href: "/customer/community", label: "Community", icon: "community" },
        { href: "/customer/news", label: "News", icon: "news" },
        { href: "/customer/promotions", label: "Promotions", icon: "promotions" },
        { href: "/customer/smart-shop", label: "Smart shop", icon: "stebo" },
        { href: "/customer/diary", label: "Diary", icon: "diary" },
        { href: "/customer/stebo", label: "Stebo", icon: "stebo" },
      ],
    },
  ];
}

export function shopNav(): NavGroupDef[] {
  return [
    {
      title: "Overview",
      items: [
        { href: "/shop", label: "Dashboard", icon: "dashboard" },
        { href: "/shop/financials", label: "Financials", icon: "wallet" },
      ],
    },
    {
      title: "Catalogue",
      items: [
        { href: "/shop/products", label: "Products", icon: "products" },
        { href: "/shop/categories", label: "Categories", icon: "categories" },
        { href: "/shop/inventory", label: "Inventory", icon: "inventory" },
        { href: "/shop/services", label: "Services", icon: "services" },
      ],
    },
    {
      title: "Selling",
      items: [
        { href: "/shop/pos", label: "POS", icon: "pos" },
        { href: "/shop/sales", label: "Sales", icon: "sales" },
        { href: "/shop/orders", label: "Orders", icon: "orders" },
        { href: "/shop/customers", label: "Customers", icon: "customers" },
        { href: "/shop/chat", label: "Messages", icon: "messages", badge: "messages" },
      ],
    },
    {
      title: "Growth",
      items: [
        { href: "/shop/promotions", label: "Promotions", icon: "promotions" },
        { href: "/shop/reports", label: "Reports", icon: "reports" },
        { href: "/shop/insights", label: "Analytics", icon: "analytics" },
      ],
    },
    {
      title: "People",
      items: [{ href: "/shop/employees", label: "Employees", icon: "employees" }],
    },
    {
      title: "Shop",
      items: [
        { href: "/shop/subscription", label: "Subscription", icon: "subscription" },
        { href: "/shop/verification", label: "Verification", icon: "verification" },
        { href: "/shop/settings", label: "Settings", icon: "settings" },
        { href: "/shop/help", label: "Help", icon: "help" },
      ],
    },
    {
      title: "More",
      defaultOpen: false,
      items: [
        { href: "/shop/quotations", label: "Quotations", icon: "quotations" },
        { href: "/shop/bookings", label: "Bookings", icon: "bookings" },
        { href: "/shop/service-requests", label: "Enquiries", icon: "enquiries" },
        { href: "/shop/payroll", label: "Payroll", icon: "payroll" },
        { href: "/shop/expenses", label: "Expenses", icon: "expenses" },
        { href: "/shop/suppliers", label: "Suppliers", icon: "suppliers" },
        { href: "/shop/purchases", label: "Purchases", icon: "purchases" },
        { href: "/shop/payments", label: "Payments", icon: "payments" },
        { href: "/shop/receipts", label: "Receipts", icon: "receipts" },
        { href: "/shop/storefront", label: "Storefront", icon: "storefront" },
        { href: "/shop/loyalty", label: "Customer loyalty", icon: "loyalty" },
        { href: "/shop/community", label: "Community", icon: "community" },
        { href: "/shop/notifications", label: "Notifications", icon: "notifications", badge: "notifications" },
        { href: "/shop/news", label: "News", icon: "news" },
        { href: "/shop/diary", label: "Diary", icon: "diary" },
        { href: "/shop/stebo", label: "Stebo", icon: "stebo" },
      ],
    },
  ];
}

export function adminNav(): NavGroupDef[] {
  return [
    {
      title: "Overview",
      items: [
        { href: "/admin", label: "Dashboard", icon: "dashboard" },
        { href: "/admin/reports", label: "Reports", icon: "reports" },
        { href: "/admin/shop-reports", label: "Shop reports", icon: "file" },
      ],
    },
    {
      title: "Marketplace",
      items: [
        { href: "/admin/customers", label: "Customers", icon: "customers" },
        { href: "/admin/shops", label: "Shops", icon: "shops" },
        { href: "/admin/verification", label: "Shop verification", icon: "verification" },
        { href: "/admin/products", label: "Products", icon: "products" },
        { href: "/admin/categories", label: "Categories", icon: "tag" },
        { href: "/admin/orders", label: "Orders and enquiries", icon: "orders" },
      ],
    },
    {
      title: "Commerce",
      items: [
        { href: "/admin/pos", label: "POS", icon: "pos" },
        { href: "/admin/payments", label: "Payments", icon: "payments" },
        { href: "/admin/receipts", label: "Receipts", icon: "receipts" },
        { href: "/admin/subscriptions", label: "Subscriptions", icon: "subscription" },
        { href: "/admin/promo-codes", label: "Promotions", icon: "promotions" },
        { href: "/admin/campaigns", label: "Campaigns", icon: "campaigns" },
      ],
    },
    {
      title: "Support",
      items: [
        { href: "/admin/chat", label: "Messages", icon: "messages", badge: "messages" },
        { href: "/admin/support", label: "Support", icon: "help" },
        { href: "/admin/notifications", label: "Notifications", icon: "notifications", badge: "notifications" },
      ],
    },
    {
      title: "People",
      items: [
        { href: "/admin/users", label: "Admin users", icon: "employees" },
        { href: "/admin/loyalty", label: "Customer loyalty", icon: "loyalty" },
        { href: "/admin/badges", label: "Badges", icon: "award" },
        { href: "/admin/ads", label: "Ads", icon: "ads" },
        { href: "/admin/news", label: "News", icon: "news" },
      ],
    },
    {
      title: "System",
      items: [
        { href: "/admin/security", label: "Audit logs", icon: "lock" },
        { href: "/admin/settings", label: "Settings", icon: "settings" },
        { href: "/admin/company", label: "Company", icon: "building" },
        { href: "/admin/languages", label: "Languages", icon: "globe" },
        { href: "/admin/expenses", label: "Expenses", icon: "expenses" },
        { href: "/admin/diary", label: "Diary", icon: "diary" },
      ],
    },
    {
      title: "Stebo",
      defaultOpen: false,
      items: [{ href: "/admin/stebo", label: "Intelligence", icon: "stebo" }],
    },
  ];
}

export function navHrefs(groups: NavGroupDef[]) {
  return groups.flatMap((group) => group.items.map((item) => item.href));
}

export function filterShopNav(
  groups: NavGroupDef[],
  options: { providerType?: string | null; allowed?: (href: string) => boolean },
) {
  const hide = options.providerType === "products" ? PRODUCTS_ONLY_HIDE : options.providerType === "services" ? SERVICES_ONLY_HIDE : null;
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (hide?.has(item.href)) return false;
        return options.allowed ? options.allowed(item.href) : true;
      }),
    }))
    .filter((group) => group.items.length);
}

export function filterNavByHref(groups: NavGroupDef[], allowed: (href: string) => boolean) {
  return groups
    .map((group) => ({ ...group, items: group.items.filter((item) => allowed(item.href)) }))
    .filter((group) => group.items.length);
}

export function shopNavLock(href: string, features?: string[] | null, disabled?: string[] | null) {
  const feature = SHOP_NAV_FEATURES[href];
  if (!feature || !features) return null;
  if (features.includes(feature)) return null;
  return disabled?.includes(feature) ? "admin" : "package";
}

export function groupStartsOpen(group: NavGroupDef, pathname: string, home: string) {
  const active = group.items.some((item) => isNavActive(pathname, item.href, home));
  if (active) return true;
  return group.defaultOpen !== false;
}

export function isNavActive(pathname: string, href: string, home: string) {
  if (pathname === href) return true;
  if (href === home) return false;
  return pathname.startsWith(`${href}/`);
}

export function mobilePrimaryHrefs(role: "customer" | "shop_owner" | "admin", staffRole?: string | null) {
  if (role === "customer") return ["/customer", "/customer/shops", "/customer/cart", "/customer/chat", "/customer/settings"];
  if (role === "admin") return ["/admin", "/admin/shops", "/admin/customers", "/admin/support", "/admin/users"];
  if (staffRole === "cashier") return ["/shop", "/shop/pos", "/shop/orders", "/shop/sales"];
  return ["/shop", "/shop/pos", "/shop/orders", "/shop/sales", "/shop/chat"];
}

export function headerSearchPath(role: "customer" | "shop_owner" | "admin") {
  if (role === "customer") return { action: "/customer/shops", placeholder: "Search shops" };
  if (role === "admin") return { action: "/admin/shops", placeholder: "Search shops" };
  return { action: "/shop/sales", placeholder: "Search sales" };
}

export function flattenNav(groups: NavGroupDef[]) {
  return groups.flatMap((group) => group.items);
}
