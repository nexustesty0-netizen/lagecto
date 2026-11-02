export type NoticeAudience = "customer" | "shop" | "admin";

export type NoticeRow = {
  id: string;
  title: string;
  message: string;
  type?: string | null;
  href?: string | null;
  reference_id?: string | null;
  is_read?: boolean | null;
  created_at: string;
};

export const NOTICE_PAGE_SIZE = 40;

export const CASHIER_NOTICE_TYPES = ["order", "enquiry", "request", "message", "general", "receipt"] as const;

export const NOTICE_FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "read", label: "Read" },
] as const;

export const NOTICE_CATEGORIES = [
  { id: "all", label: "All types" },
  { id: "message", label: "Messages" },
  { id: "order", label: "Orders" },
  { id: "enquiry", label: "Enquiries" },
  { id: "stock", label: "Stock" },
  { id: "support", label: "Support" },
  { id: "announcement", label: "Announcements" },
  { id: "billing", label: "Billing" },
  { id: "account", label: "Account" },
] as const;

export type NoticeCategoryId = (typeof NOTICE_CATEGORIES)[number]["id"];

export function noticeKind(type?: string | null) {
  return String(type || "general").trim().toLowerCase();
}

export function noticeCategory(type?: string | null): Exclude<NoticeCategoryId, "all"> {
  const kind = noticeKind(type);
  if (kind === "order" || kind === "receipt" || kind === "preorder" || kind === "pre-order") return "order";
  if (kind === "enquiry" || kind === "request") return "enquiry";
  if (kind === "stock") return "stock";
  if (kind === "support") return "support";
  if (kind === "announcement" || kind === "admin" || kind === "achievement") return "announcement";
  if (kind === "billing" || kind === "subscription" || kind === "payment") return "billing";
  if (kind === "security" || kind === "account" || kind === "registration" || kind === "verification") return "account";
  if (kind === "message") return "message";
  return "announcement";
}

export function isEssentialNotice(type?: string | null) {
  const kind = noticeKind(type);
  return kind === "security" || kind === "account";
}

export function staffMaySeeNotice(role: string | null | undefined, type?: string | null) {
  if (role !== "cashier") return true;
  return (CASHIER_NOTICE_TYPES as readonly string[]).includes(noticeKind(type));
}

export function orderNumberFromNotice(message?: string | null) {
  const text = String(message || "");
  const match = text.match(/\bOrder\s+([A-Z0-9][A-Z0-9-]{3,})\b/i);
  return match?.[1] || null;
}

export function notificationInboxPath(audience: NoticeAudience) {
  if (audience === "shop") return "/shop/notifications";
  if (audience === "admin") return "/admin/notifications";
  return "/customer/notifications";
}

export function notificationReadPath(audience: NoticeAudience, id: string) {
  return `${notificationInboxPath(audience)}/${id}`;
}

export function notificationRelatedHref(item: Pick<NoticeRow, "type" | "href" | "reference_id" | "message">, audience: NoticeAudience) {
  if (item.href) return item.href;
  const kind = noticeKind(item.type);
  const ref = item.reference_id;
  if (audience === "customer") {
    if (kind === "order" && ref) return `/customer/orders/${ref}`;
    if ((kind === "enquiry" || kind === "request") && ref) return `/customer/requests/${ref}`;
    if (kind === "receipt" && ref) return `/customer/receipts/${ref}`;
    if (kind === "message" && ref) return `/customer/chat?c=${ref}`;
    return null;
  }
  if (audience === "shop") {
    if (kind === "order" && ref) return `/shop/orders/${ref}`;
    if (kind === "order") return "/shop/orders";
    if ((kind === "enquiry" || kind === "request") && ref) return `/shop/service-requests/${ref}`;
    if (kind === "enquiry" || kind === "request") return "/shop/service-requests";
    if (kind === "message" && ref) return `/shop/chat?c=${ref}`;
    if (kind === "support" && ref) return `/shop/chat?c=${ref}`;
    if (kind === "support") return "/shop/chat";
    if (kind === "stock") return "/shop/inventory";
    if (kind === "billing" || kind === "subscription" || kind === "payment") return "/shop/subscription";
    return null;
  }
  if (kind === "message" && ref) return `/admin/chat?c=${ref}`;
  if (kind === "support" && ref) return `/admin/chat?c=${ref}`;
  if (kind === "support") return "/admin/chat";
  if (kind === "registration") return "/admin/verification?tab=registrations";
  if (kind === "verification") return "/admin/verification";
  return item.href || null;
}

export function notificationOpenHref(item: NoticeRow, audience: NoticeAudience) {
  return notificationReadPath(audience, item.id);
}

export function relatedRecordLabel(type?: string | null) {
  const kind = noticeKind(type);
  if (kind === "order") return "View order";
  if (kind === "enquiry" || kind === "request") return "View enquiry";
  if (kind === "receipt") return "View receipt";
  if (kind === "message" || kind === "support") return "Open chat";
  if (kind === "stock") return "View inventory";
  if (kind === "billing" || kind === "subscription" || kind === "payment") return "View billing";
  if (kind === "registration" || kind === "verification") return "View request";
  return "Open";
}

export function noticePreview(message?: string | null, max = 90) {
  const text = String(message || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

export function isNoticeUuid(value: string | null | undefined) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

export function noticePage(raw?: string | number | null) {
  const page = Math.trunc(Number(raw || 1));
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function isQuietHoursWindow(startClock: string, endClock: string, at = new Date()) {
  if (!/^\d{2}:\d{2}$/.test(startClock) || !/^\d{2}:\d{2}$/.test(endClock)) return false;
  const [startH, startM] = startClock.split(":").map(Number);
  const [endH, endM] = endClock.split(":").map(Number);
  const start = startH * 60 + startM;
  const end = endH * 60 + endM;
  const now = at.getHours() * 60 + at.getMinutes();
  if (start === end) return false;
  if (start < end) return now >= start && now < end;
  return now >= start || now < end;
}
