export const TOGGLEABLE_FEATURES = [
  { key: "smart_diary_full", label: "Smart Diary Pro", description: "Advanced diary modules for the shop owner." },
  { key: "pos", label: "Point of Sale", description: "In-shop till. Existing sales stay in history if turned off." },
  { key: "customer_chat", label: "Messaging", description: "Customer and shop conversations." },
  { key: "inventory", label: "Inventory", description: "Stock counts, adjustments, and movement history." },
  { key: "promotions", label: "Promotions", description: "Discounts and featured offers." },
  { key: "blogs", label: "Blog", description: "Storefront posts and vlogs." },
  { key: "advanced_storefront", label: "Storefront customization", description: "Extended branding and media." },
  { key: "analytics", label: "Advanced analytics", description: "Sandra insights. Does not expose other shops." },
  { key: "employees", label: "Employees", description: "HR records for this shop only." },
  { key: "payroll", label: "Payroll", description: "Staff pay. Historical records are kept if turned off." },
  { key: "expenses", label: "Expenses", description: "Shop operating costs for this shop only." },
  { key: "receipts", label: "Receipts", description: "Digital receipts." },
] as const;

export type ToggleableFeatureKey = (typeof TOGGLEABLE_FEATURES)[number]["key"];

export const EXPENSE_CATEGORIES = [
  "rent",
  "utilities",
  "transport",
  "supplies",
  "payroll",
  "marketing",
  "maintenance",
  "internet",
  "equipment",
  "other",
] as const;

export const PLATFORM_EXPENSE_CATEGORIES = [
  "operations",
  "hosting",
  "marketing",
  "support",
  "legal",
  "equipment",
  "other",
] as const;

export const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
  { value: "contract", label: "Contract" },
  { value: "casual", label: "Casual" },
] as const;

export const PAY_FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly", label: "Monthly" },
] as const;

export const REPORT_CATEGORIES = [
  { value: "operational", label: "Operational update" },
  { value: "stock", label: "Stock issue" },
  { value: "customer", label: "Customer issue" },
  { value: "staff", label: "Staff issue" },
  { value: "maintenance", label: "Maintenance" },
  { value: "observation", label: "Business observation" },
  { value: "incident", label: "Incident" },
] as const;
