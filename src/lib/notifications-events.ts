export const NOTIFICATIONS_EVENT = "lagecto:notifications";
export const NAV_BADGES_EVENT = "lagecto:nav-badges";

export type NavBadgeCounts = { unread: number; unreadMessages: number };

export function emitNotificationsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NOTIFICATIONS_EVENT));
  }
}

export function emitNavBadges(counts: NavBadgeCounts) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NAV_BADGES_EVENT, { detail: counts }));
}
