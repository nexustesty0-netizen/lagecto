export const WEEKDAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
] as const;

export type WeekdayKey = (typeof WEEKDAYS)[number]["key"];

export type DayHours = {
  open: string;
  close: string;
  closed: boolean;
};

export type OpeningHours = {
  timezone: string;
  days: Record<WeekdayKey, DayHours>;
};

export const DEFAULT_TIMEZONE = "Africa/Harare";

const EMPTY_DAY: DayHours = { open: "08:00", close: "17:00", closed: true };

const WEEKDAY_FROM_SHORT: Record<string, WeekdayKey> = {
  mon: "mon",
  tue: "tue",
  wed: "wed",
  thu: "thu",
  fri: "fri",
  sat: "sat",
  sun: "sun",
};

function asDay(value: unknown): DayHours {
  if (!value || typeof value !== "object") return { ...EMPTY_DAY };
  const row = value as Record<string, unknown>;
  return {
    open: typeof row.open === "string" && /^\d{2}:\d{2}$/.test(row.open) ? row.open : "08:00",
    close: typeof row.close === "string" && /^\d{2}:\d{2}$/.test(row.close) ? row.close : "17:00",
    closed: Boolean(row.closed),
  };
}

export function defaultOpeningHours(): OpeningHours {
  return {
    timezone: DEFAULT_TIMEZONE,
    days: {
      mon: { ...EMPTY_DAY },
      tue: { ...EMPTY_DAY },
      wed: { ...EMPTY_DAY },
      thu: { ...EMPTY_DAY },
      fri: { ...EMPTY_DAY },
      sat: { ...EMPTY_DAY },
      sun: { ...EMPTY_DAY },
    },
  };
}

export function parseOpeningHours(raw: unknown): OpeningHours {
  const base = defaultOpeningHours();
  if (!raw || typeof raw !== "object") return base;
  const input = raw as Record<string, unknown>;
  const nested = input.days && typeof input.days === "object" ? (input.days as Record<string, unknown>) : input;
  const timezone = typeof input.timezone === "string" && input.timezone ? input.timezone : DEFAULT_TIMEZONE;
  for (const day of WEEKDAYS) {
    base.days[day.key] = asDay(nested[day.key]);
  }
  base.timezone = timezone;
  return base;
}

export function hasScheduledHours(hours: OpeningHours) {
  return WEEKDAYS.some((day) => {
    const slot = hours.days[day.key];
    return slot && !slot.closed;
  });
}

function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function zoneParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const weekday = (parts.find((part) => part.type === "weekday")?.value || "Mon").slice(0, 3).toLowerCase();
  const hour = Number(parts.find((part) => part.type === "hour")?.value || "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value || "0");
  return { weekday: WEEKDAY_FROM_SHORT[weekday] || "mon", minutes: hour * 60 + minute };
}

export function isOpenAt(hours: OpeningHours, date = new Date()) {
  const { weekday, minutes: now } = zoneParts(date, hours.timezone || DEFAULT_TIMEZONE);
  const slot = hours.days[weekday];
  if (!slot || slot.closed) return false;
  const open = minutes(slot.open);
  const close = minutes(slot.close);
  if (open === close) return true;
  if (close > open) return now >= open && now < close;
  return now >= open || now < close;
}

export function shopIsOpenNow(shop: {
  is_open?: boolean | null;
  auto_close?: boolean | null;
  opening_hours?: unknown;
}) {
  const hours = parseOpeningHours(shop.opening_hours);
  const followHours = shop.auto_close !== false && hasScheduledHours(hours);
  if (followHours) return isOpenAt(hours);
  return Boolean(shop.is_open);
}

export function formatDayHours(slot: DayHours) {
  if (slot.closed) return "Closed";
  return `${slot.open} – ${slot.close}`;
}

export function withComputedOpen<T extends { is_open?: boolean | null; auto_close?: boolean | null; opening_hours?: unknown }>(
  shop: T,
): T & { is_open: boolean } {
  return { ...shop, is_open: shopIsOpenNow(shop) };
}
