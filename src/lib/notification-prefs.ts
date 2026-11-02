import { isEssentialNotice, isQuietHoursWindow, noticeCategory, noticeKind } from "./notifications";

export const NOTICE_SOUND_IDS = ["chime", "soft", "ping"] as const;
export type NoticeSoundId = (typeof NOTICE_SOUND_IDS)[number];

export type NoticeCategoryPrefs = {
  message: boolean;
  order: boolean;
  enquiry: boolean;
  stock: boolean;
  support: boolean;
  announcement: boolean;
  billing: boolean;
  review: boolean;
  security: boolean;
  account: boolean;
};

export type NoticePrefs = {
  sound: boolean;
  popups: boolean;
  browser: boolean;
  email: boolean;
  soundId: NoticeSoundId;
  quietStart: string;
  quietEnd: string;
  categories: NoticeCategoryPrefs;
};

export const DEFAULT_NOTICE_PREFS: NoticePrefs = {
  sound: true,
  popups: true,
  browser: false,
  email: true,
  soundId: "chime",
  quietStart: "",
  quietEnd: "",
  categories: {
    message: true,
    order: true,
    enquiry: true,
    stock: true,
    support: true,
    announcement: true,
    billing: true,
    review: true,
    security: true,
    account: true,
  },
};

function asBool(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (value === "on" || value === "true" || value === 1) return true;
  if (value === "off" || value === "false" || value === 0) return false;
  return fallback;
}

function asSoundId(value: unknown): NoticeSoundId {
  return NOTICE_SOUND_IDS.includes(value as NoticeSoundId) ? (value as NoticeSoundId) : "chime";
}

function asHour(value: unknown) {
  const text = String(value || "").trim();
  return /^\d{2}:\d{2}$/.test(text) ? text : "";
}

function categoryValue(source: Record<string, unknown>, key: keyof NoticeCategoryPrefs, aliases: unknown[] = []) {
  const nested = source.categories && typeof source.categories === "object" ? (source.categories as Record<string, unknown>)[key] : undefined;
  for (const value of [source[key], ...aliases, nested]) {
    if (value !== undefined) return asBool(value, true);
  }
  return true;
}

export function parseNoticePrefs(raw: unknown): NoticePrefs {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    sound: asBool(source.sound, DEFAULT_NOTICE_PREFS.sound),
    popups: asBool(source.popups, true),
    browser: asBool(source.browser, false),
    email: asBool(source.email, true),
    soundId: asSoundId(source.soundId),
    quietStart: asHour(source.quietStart),
    quietEnd: asHour(source.quietEnd),
    categories: {
      message: categoryValue(source, "message", [source.messageSound]),
      order: categoryValue(source, "order", [source.orderSound]),
      enquiry: categoryValue(source, "enquiry"),
      stock: categoryValue(source, "stock"),
      support: categoryValue(source, "support", [source.supportSound]),
      announcement: categoryValue(source, "announcement", [source.announcementSound]),
      billing: categoryValue(source, "billing"),
      review: categoryValue(source, "review"),
      security: categoryValue(source, "security"),
      account: categoryValue(source, "account"),
    },
  };
}

export function readLocalNoticePrefs(): NoticePrefs {
  if (typeof window === "undefined") return DEFAULT_NOTICE_PREFS;
  const kinds = window.localStorage.getItem("lg-sound-kinds");
  const kindList = kinds ? kinds.split(",") : null;
  return parseNoticePrefs({
    sound: window.localStorage.getItem("lg-sound") !== "off",
    popups: window.localStorage.getItem("lg-popups") !== "off",
    browser: window.localStorage.getItem("lg-browser") === "on",
    email: window.localStorage.getItem("lg-email") !== "off",
    soundId: window.localStorage.getItem("lg-sound-id"),
    quietStart: window.localStorage.getItem("lg-quiet-start"),
    quietEnd: window.localStorage.getItem("lg-quiet-end"),
    message: kindList ? kindList.includes("message") : true,
    order: kindList ? kindList.includes("order") : true,
    announcement: kindList ? kindList.includes("announcement") : true,
    support: kindList ? kindList.includes("support") : true,
  });
}

export function writeLocalNoticePrefs(prefs: NoticePrefs) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("lg-sound", prefs.sound ? "on" : "off");
  window.localStorage.setItem("lg-popups", prefs.popups ? "on" : "off");
  window.localStorage.setItem("lg-browser", prefs.browser ? "on" : "off");
  window.localStorage.setItem("lg-email", prefs.email ? "on" : "off");
  window.localStorage.setItem("lg-sound-id", prefs.soundId);
  window.localStorage.setItem("lg-quiet-start", prefs.quietStart);
  window.localStorage.setItem("lg-quiet-end", prefs.quietEnd);
  window.localStorage.setItem(
    "lg-sound-kinds",
    Object.entries(prefs.categories)
      .filter(([, on]) => on)
      .map(([key]) => key)
      .join(","),
  );
}

export function isQuietHours(prefs: NoticePrefs, at = new Date()) {
  return isQuietHoursWindow(prefs.quietStart, prefs.quietEnd, at);
}

export function categoryAllowed(prefs: NoticePrefs, type?: string | null) {
  if (isEssentialNotice(type)) return true;
  const kind = noticeKind(type);
  if (kind === "review") return prefs.categories.review !== false;
  const category = noticeCategory(type);
  return prefs.categories[category as keyof NoticeCategoryPrefs] !== false;
}

export function shouldPlaySound(prefs: NoticePrefs, type?: string | null, at?: Date) {
  if (!prefs.sound) return false;
  if (typeof window !== "undefined" && window.localStorage.getItem("lg-interacted") !== "1") return false;
  if (isQuietHours(prefs, at) && !isEssentialNotice(type)) return false;
  if (!categoryAllowed(prefs, type) && noticeKind(type) !== "general") return false;
  return true;
}

export function shouldShowPopup(prefs: NoticePrefs, type?: string | null, at?: Date) {
  if (isEssentialNotice(type)) return true;
  if (!prefs.popups) return false;
  if (isQuietHours(prefs, at)) return false;
  return categoryAllowed(prefs, type);
}

export function shouldShowBrowserAlert(prefs: NoticePrefs, type?: string | null) {
  if (!prefs.browser) return false;
  if (typeof document === "undefined" || !document.hidden) return false;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
  return shouldShowPopup(prefs, type) || isEssentialNotice(type);
}
