export const SUPPORT_KINDS = ["support", "bug", "technical", "feedback", "shop_report"] as const;
export type SupportKind = (typeof SUPPORT_KINDS)[number];

export const SUPPORT_CATEGORIES = [
  "account",
  "payment",
  "order",
  "shop",
  "technical",
  "bug",
  "security",
  "loyalty",
  "promotion",
  "stebo",
  "storefront",
  "products",
  "inventory",
  "pos",
  "payroll",
  "expenses",
  "other",
] as const;

export const SHOP_EXTRA_CATEGORIES = [
  "storefront",
  "products",
  "inventory",
  "pos",
  "payroll",
  "expenses",
  "promotions",
  "loyalty",
  "orders",
  "settings",
  "payments",
  "verification",
] as const;

export const BUG_AREAS = [
  "login",
  "signup",
  "marketplace",
  "shop",
  "product",
  "cart",
  "checkout",
  "payment",
  "orders",
  "messaging",
  "loyalty",
  "promotions",
  "stebo",
  "dashboard",
  "settings",
  "other",
] as const;

export const SHOP_REPORT_REASONS = [
  { id: "scam", label: "Suspected scam or fraud" },
  { id: "fake", label: "Fake products/services" },
  { id: "not_as_described", label: "Product/service not as described" },
  { id: "payment", label: "Payment problem" },
  { id: "suspicious", label: "Suspicious behaviour" },
  { id: "misleading", label: "Misleading information" },
  { id: "harassment", label: "Harassment or inappropriate behaviour" },
  { id: "counterfeit", label: "Counterfeit goods" },
  { id: "spam", label: "Spam" },
  { id: "prohibited", label: "Prohibited content" },
  { id: "impersonation", label: "Shop impersonation" },
  { id: "other", label: "Other" },
] as const;

export const TECHNICAL_ISSUES = [
  { id: "wont_load", label: "App won't load", guide: "refresh-and-connection" },
  { id: "login", label: "Login problem", guide: "login-lock" },
  { id: "account", label: "Account problem", guide: "login-lock" },
  { id: "slow", label: "Slow performance", guide: "refresh-and-connection" },
  { id: "checkout", label: "Checkout problem", guide: "checkout-problems" },
  { id: "payment", label: "Payment issue", guide: "checkout-problems" },
  { id: "upload", label: "Image upload issue", guide: "refresh-and-connection" },
  { id: "notifications", label: "Notification issue", guide: "refresh-and-connection" },
  { id: "messaging", label: "Messaging issue", guide: "refresh-and-connection" },
  { id: "browser", label: "Browser compatibility issue", guide: "refresh-and-connection" },
] as const;

export const FEEDBACK_CATEGORIES = [
  "feature",
  "experience",
  "design",
  "marketplace",
  "shop",
  "stebo",
  "loyalty",
  "performance",
  "general",
] as const;

export function capSupportPriority(category: string, priority: string) {
  const cat = String(category || "").toLowerCase();
  const pri = String(priority || "normal").toLowerCase();
  if (pri === "urgent" && ["payment", "payments", "security", "account"].includes(cat)) return "urgent";
  if (pri === "high" || pri === "urgent") return "high";
  return "normal";
}

export const FAQ_SECTION_LABELS: Record<string, string> = {
  account: "Account",
  shopping: "Shopping",
  payments: "Payments",
  shops: "Shops",
  loyalty: "Loyalty & Rewards",
  stebo: "Stebo",
  security: "Security",
  technical: "Technical Support",
  general: "General",
  diary: "Diary",
};

export const SUPPORT_STATUSES = ["open", "in_progress", "waiting_customer", "resolved", "closed"] as const;
export const BUG_STATUSES = ["new", "confirmed", "investigating", "in_development", "testing", "resolved", "closed", "cannot_reproduce"] as const;
export const SHOP_REPORT_STATUSES = ["new", "under_review", "awaiting_information", "action_required", "resolved", "dismissed", "escalated"] as const;
export const FEEDBACK_STATUSES = ["new", "in_progress", "resolved", "closed"] as const;

export function statusesForKind(kind: string) {
  if (kind === "bug") return BUG_STATUSES;
  if (kind === "shop_report") return SHOP_REPORT_STATUSES;
  if (kind === "feedback") return FEEDBACK_STATUSES;
  return SUPPORT_STATUSES;
}

export function supportNav(basePath: string) {
  const b = basePath.replace(/\/$/, "") || "/support";
  return [
    { href: b, label: "Home" },
    { href: `${b}/faqs`, label: "FAQs" },
    { href: `${b}/contact`, label: "Contact" },
    { href: `${b}/tickets`, label: "My requests" },
    { href: `${b}/bug`, label: "Report a bug" },
    { href: `${b}/technical`, label: "Technical issues" },
    { href: `${b}/feedback`, label: "Feedback" },
    { href: `${b}/report-shop`, label: "Report a shop" },
    { href: `${b}/safety`, label: "Safety" },
    { href: `${b}/about`, label: "About" },
    { href: `${b}/terms`, label: "Terms" },
    { href: `${b}/privacy`, label: "Privacy" },
  ];
}
