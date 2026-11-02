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
  thabi: { "1_month": 4.5, "3_months": 11, "6_months": 21, "9_months": 30, "1_year": 38 },
  kristen: { "1_month": 6.5, "3_months": 16, "6_months": 30, "9_months": 44, "1_year": 55 },
  sandra: { "1_month": 8, "3_months": 20, "6_months": 37.5, "9_months": 54, "1_year": 67 },
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

export const PACKAGE_LIMITS: Record<PackageKey, { gallery: number; videos: number; blogs: number; catalogDeviceImages: number | null }> = {
  free: { gallery: 48, videos: 24, blogs: 99, catalogDeviceImages: 4 },
  thabi: { gallery: 12, videos: 0, blogs: 0, catalogDeviceImages: 8 },
  kristen: { gallery: 24, videos: 8, blogs: 24, catalogDeviceImages: 10 },
  sandra: { gallery: 48, videos: 24, blogs: 99, catalogDeviceImages: null },
};

export const FREE_PLAN_HIGHLIGHTS = [
  "POS and receipts",
  "Inventory and catalogue",
  "Digital storefront",
  "Orders and WhatsApp checkout",
  "Expenses, payroll, and profit & loss",
  "Staff, diary, and analytics",
] as const;

export const PACKAGE_CARD_POINTS: Record<PaidPackageKey, string[]> = {
  thabi: ["Verified shop badge", "Public storefront", "Orders and WhatsApp checkout", "POS and receipts"],
  kristen: ["Everything in Thabi", "Custom branding", "Blogs and staff tools", "Smart Diary Pro"],
  sandra: ["Everything in Kristen", "Analytics", "Advanced POS and inventory", "Priority support"],
};

export const PACKAGE_THEME: Record<PackageKey, { accent: string; wash: string; ink: string }> = {
  free: { accent: "#0B6E4F", wash: "#E8F4EE", ink: "#0B6E4F" },
  thabi: { accent: "#0B6E4F", wash: "#E7F3EC", ink: "#0B6E4F" },
  kristen: { accent: "#D4AF37", wash: "#F8F1D8", ink: "#6B5208" },
  sandra: { accent: "#0B6E4F", wash: "#DCE8E2", ink: "#0B6E4F" },
};

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

export function catalogDeviceImageLimit(key?: string | null) {
  return PACKAGE_LIMITS[normalizePackageKey(key)].catalogDeviceImages;
}

export function catalogDeviceImageMessage(key?: string | null) {
  const pack = normalizePackageKey(key);
  const limit = PACKAGE_LIMITS[pack].catalogDeviceImages;
  const name = PACKAGE_META[pack].name;
  if (limit == null) return `${name} can store unlimited service and product photos from this device.`;
  return `${name} can store ${limit} service or product photos from this device. Extra items can use an image URL.`;
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

export function emptyCatalogPrices(): Record<PaidPackageKey, Record<DurationKey, number>> {
  return {
    thabi: { ...PACKAGE_PRICES.thabi },
    kristen: { ...PACKAGE_PRICES.kristen },
    sandra: { ...PACKAGE_PRICES.sandra },
  };
}

export function catalogPricesFromPlans(
  plans: {
    package_key?: string | null;
    duration_key?: string | null;
    duration_months?: number | null;
    price?: number | null;
    promo_price?: number | null;
    is_active?: boolean | null;
  }[],
): Record<PaidPackageKey, Record<DurationKey, number>> {
  const prices = emptyCatalogPrices();
  for (const plan of plans) {
    if (plan.is_active === false) continue;
    if (!isPaidPackage(plan.package_key)) continue;
    const duration = normalizeDurationKey(plan.duration_key, plan.duration_months);
    const promo = plan.promo_price == null ? NaN : Number(plan.promo_price);
    const amount = Number.isFinite(promo) ? promo : Number(plan.price);
    if (Number.isFinite(amount) && amount >= 0) prices[plan.package_key][duration] = amount;
  }
  return prices;
}

export function planSlug(packageKey: PaidPackageKey, duration: DurationKey) {
  return `${packageKey}-${duration.replaceAll("_", "-")}`;
}
