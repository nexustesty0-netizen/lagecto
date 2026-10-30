export const PACKAGE_KEYS = {
  FREE: "free",
  THABI: "thabi",
  KRISTEN: "kristen",
  SANDRA: "sandra",
} as const;

export type PackageKey = (typeof PACKAGE_KEYS)[keyof typeof PACKAGE_KEYS];
export type PaidPackageKey = "thabi" | "kristen" | "sandra";

export const DURATION_KEYS = ["1_month", "3_months", "6_months", "9_months", "1_year"] as const;
export type DurationKey = (typeof DURATION_KEYS)[number];

export const DURATION_MONTHS: Record<DurationKey, number> = {
  "1_month": 1,
  "3_months": 3,
  "6_months": 6,
  "9_months": 9,
  "1_year": 12,
};

export const DURATION_LABELS: Record<DurationKey, string> = {
  "1_month": "1 Month",
  "3_months": "3 Months",
  "6_months": "6 Months",
  "9_months": "9 Months",
  "1_year": "1 Year",
};

export const PACKAGE_PRICES: Record<PaidPackageKey, Record<DurationKey, number>> = {
  thabi: { "1_month": 2, "3_months": 5, "6_months": 9, "9_months": 13, "1_year": 16 },
  kristen: { "1_month": 3.5, "3_months": 9, "6_months": 16, "9_months": 22, "1_year": 28 },
  sandra: { "1_month": 5, "3_months": 13, "6_months": 23, "9_months": 32, "1_year": 40 },
};

const CORE_FEATURES = [
  "dashboard",
  "product_listings",
  "digital_storefront",
  "settings",
  "inventory",
  "pos",
  "promotions",
  "order_management",
  "notifications",
  "quotations",
  "business_profile_basic",
] as const;

const THABI_FEATURES = [
  ...CORE_FEATURES,
  "customer_reviews",
  "reports_standard",
  "smart_diary_limited",
  "one_shop",
] as const;

const KRISTEN_FEATURES = [
  ...THABI_FEATURES,
  "custom_branding",
  "cover_image",
  "advanced_storefront",
  "blogs",
  "advanced_promotions",
  "employees",
  "customer_chat",
  "smart_diary_full",
  "profit_loss",
  "expenses",
  "payroll",
  "receipts",
] as const;

const SANDRA_FEATURES = [
  ...KRISTEN_FEATURES,
  "analytics",
  "advanced_pos",
  "advanced_inventory",
  "priority_support",
  "early_access",
] as const;

export const PACKAGE_FEATURES: Record<PackageKey, readonly string[]> = {
  free: SANDRA_FEATURES,
  thabi: THABI_FEATURES,
  kristen: KRISTEN_FEATURES,
  sandra: SANDRA_FEATURES,
};

export const PACKAGE_LIMITS: Record<PackageKey, { gallery: number; videos: number; blogs: number }> = {
  free: { gallery: 48, videos: 24, blogs: 99 },
  thabi: { gallery: 12, videos: 0, blogs: 0 },
  kristen: { gallery: 24, videos: 8, blogs: 24 },
  sandra: { gallery: 48, videos: 24, blogs: 99 },
};

export const FREE_PLAN_HIGHLIGHTS = [
  "POS and receipts",
  "Inventory and catalogue",
  "Digital storefront",
  "Orders and WhatsApp checkout",
  "Expenses, payroll, and profit & loss",
  "Staff, diary, and analytics",
] as const;

export const PACKAGE_META = {
  free: {
    name: "Free",
    tagline: "Start selling on LaGecto",
    monthlyPrice: 0,
    yearlyPrice: 0,
    description:
      "Open a shop and start selling. For now every shop tool is included on Free — unpaid shops are not limited.",
    features: PACKAGE_FEATURES.free,
  },
  thabi: {
    name: "Thabi",
    tagline: "Verified essential shop",
    monthlyPrice: PACKAGE_PRICES.thabi["1_month"],
    yearlyPrice: PACKAGE_PRICES.thabi["1_year"],
    description: "Everything in Free, plus a verified badge and a stronger public presence while your paid plan is active.",
    features: PACKAGE_FEATURES.thabi,
  },
  kristen: {
    name: "Kristen",
    tagline: "Branded storefront and business tools",
    monthlyPrice: PACKAGE_PRICES.kristen["1_month"],
    yearlyPrice: PACKAGE_PRICES.kristen["1_year"],
    description: "Everything in Thabi plus custom branding, blogs and vlogs, advanced storefront, staff tools, and Smart Diary Pro.",
    features: PACKAGE_FEATURES.kristen,
  },
  sandra: {
    name: "Sandra",
    tagline: "Full LaGecto shop OS",
    monthlyPrice: PACKAGE_PRICES.sandra["1_month"],
    yearlyPrice: PACKAGE_PRICES.sandra["1_year"],
    description: "Everything in Kristen plus analytics, advanced POS and inventory, and every LaGecto shop tool.",
    features: PACKAGE_FEATURES.sandra,
  },
} as const;

export const FEATURE_LABELS: Record<string, string> = {
  dashboard: "Shop dashboard",
  one_shop: "One shop profile",
  product_listings: "Products and services",
  digital_storefront: "Digital storefront",
  settings: "Shop settings",
  inventory: "Inventory",
  pos: "Point of Sale",
  promotions: "Promotions",
  order_management: "Order management",
  quotations: "Quotations and estimates",
  customer_reviews: "Customer reviews",
  reports_standard: "Basic reports",
  notifications: "Notifications",
  business_profile_basic: "Shop profile and hours",
  smart_diary_limited: "Basic business diary",
  custom_branding: "Custom branding and colors",
  cover_image: "Cover image",
  advanced_storefront: "Advanced storefront media",
  blogs: "Blogs and vlogs",
  advanced_promotions: "Advanced promotions",
  employees: "Employee management",
  customer_chat: "Customer chat",
  smart_diary_full: "Smart Diary Pro",
  profit_loss: "Profit and loss tracking",
  expenses: "Expenses",
  payroll: "Payroll",
  receipts: "Receipts",
  analytics: "Advanced analytics",
  advanced_pos: "Advanced POS",
  advanced_inventory: "Advanced inventory",
  priority_support: "Priority support",
  early_access: "Early access",
};

export const KRISTEN_ONLY = new Set(
  (PACKAGE_FEATURES.kristen as readonly string[]).filter((feature) => !(PACKAGE_FEATURES.thabi as readonly string[]).includes(feature)),
);

export const PAID_PACKAGE_KEYS: PaidPackageKey[] = ["thabi", "kristen", "sandra"];

export function isPaidPackage(key?: string | null): key is PaidPackageKey {
  return key === "thabi" || key === "kristen" || key === "sandra";
}

export function normalizePackageKey(value?: string | null): PackageKey {
  const key = String(value || "free").toLowerCase();
  if (key === "thabi" || key === "kristen" || key === "sandra" || key === "free") return key;
  return "free";
}

export function featuresForPackage(key?: string | null) {
  return new Set(PACKAGE_FEATURES[normalizePackageKey(key)]);
}

function packageIncludes(key: PackageKey, feature: string) {
  return (PACKAGE_FEATURES[key] as readonly string[]).includes(feature);
}

export function packageRequiredFor(feature: string): PaidPackageKey | "free" {
  if (packageIncludes("free", feature)) return "free";
  if (packageIncludes("thabi", feature)) return "thabi";
  if (packageIncludes("kristen", feature)) return "kristen";
  return "sandra";
}

export function durationFromMonths(months?: number | null): DurationKey {
  if (months === 3) return "3_months";
  if (months === 6) return "6_months";
  if (months === 9) return "9_months";
  if (months === 12) return "1_year";
  return "1_month";
}

export function normalizeDurationKey(value?: string | null, months?: number | null): DurationKey {
  const key = String(value || "").toLowerCase();
  if ((DURATION_KEYS as readonly string[]).includes(key)) return key as DurationKey;
  return durationFromMonths(months);
}

export function priceFor(packageKey: PaidPackageKey, duration: DurationKey) {
  return PACKAGE_PRICES[packageKey][duration];
}

export function planSlug(packageKey: PaidPackageKey, duration: DurationKey) {
  return `${packageKey}-${duration.replaceAll("_", "-")}`;
}
