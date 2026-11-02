"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_NOTICE_PREFS,
  parseNoticePrefs,
  readLocalNoticePrefs,
  writeLocalNoticePrefs,
  type NoticeCategoryPrefs,
  type NoticePrefs,
  type NoticeSoundId,
} from "@/lib/notification-prefs";
import { previewNotificationSound, unlockNotificationAudio } from "@/lib/notification-sound";

const CATEGORY_LABELS: { key: keyof NoticeCategoryPrefs; label: string; locked?: boolean }[] = [
  { key: "message", label: "Messages" },
  { key: "order", label: "Orders and receipts" },
  { key: "enquiry", label: "Enquiries" },
  { key: "stock", label: "Stock alerts" },
  { key: "support", label: "Support" },
  { key: "announcement", label: "Announcements" },
  { key: "billing", label: "Billing and subscriptions" },
  { key: "review", label: "Reviews" },
  { key: "security", label: "Security alerts", locked: true },
  { key: "account", label: "Account alerts", locked: true },
];

export function NotificationPrefs() {
  const [prefs, setPrefs] = useState<NoticePrefs>(DEFAULT_NOTICE_PREFS);
  const [browserNote, setBrowserNote] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const local = readLocalNoticePrefs();
    setPrefs(local);
    setReady(true);
    void fetch("/api/notifications", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.prefs) return;
        const next = parseNoticePrefs(data.prefs);
        setPrefs(next);
        writeLocalNoticePrefs(next);
      })
      .catch(() => undefined);
  }, []);

  function persist(next: NoticePrefs) {
    setPrefs(next);
    writeLocalNoticePrefs(next);
    void fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences: next }),
    });
  }

  async function toggleBrowser(enabled: boolean) {
    unlockNotificationAudio();
    if (!enabled) {
      persist({ ...prefs, browser: false });
      setBrowserNote("");
      return;
    }
    if (typeof Notification === "undefined") {
      persist({ ...prefs, browser: false });
      setBrowserNote("This browser does not support tab alerts. In-app notifications still work.");
      return;
    }
    if (Notification.permission === "denied") {
      persist({ ...prefs, browser: false });
      setBrowserNote("This browser blocked tab alerts. In-app notifications still work.");
      return;
    }
    if (Notification.permission === "default") {
      const result = await Notification.requestPermission();
      if (result !== "granted") {
        persist({ ...prefs, browser: false });
        setBrowserNote("Tab alerts were not enabled. In-app notifications still work.");
        return;
      }
    }
    persist({ ...prefs, browser: true });
    setBrowserNote("Tab alerts appear while LaGecto is open in another tab. They are not sent after you close the app.");
  }

  if (!ready) {
    return (
      <section className="os-surface grid max-w-lg gap-3">
        <h2 className="font-semibold">Notification settings</h2>
        <p className="text-sm text-[var(--lagecto-muted)]">Loading your saved preferences…</p>
      </section>
    );
  }

  return (
    <section className="os-surface grid max-w-lg gap-4">
      <div>
        <h2 className="font-semibold">Notification settings</h2>
        <p className="mt-1 text-sm text-[var(--lagecto-muted)]">
          Sounds play after you tap the app, because browsers block autoplay. Security and account alerts stay visible.
        </p>
      </div>

      <label className="flex items-center justify-between gap-3 text-sm">
        Notification sounds
        <input
          type="checkbox"
          checked={prefs.sound}
          onChange={(event) => persist({ ...prefs, sound: event.target.checked })}
        />
      </label>

      <div className="grid gap-2">
        <p className="text-sm font-medium">Sound</p>
        <div className="flex flex-wrap gap-2">
          {(["chime", "soft", "ping"] as NoticeSoundId[]).map((id) => (
            <button
              key={id}
              type="button"
              className={`rounded-full border px-3 py-1.5 text-sm capitalize ${prefs.soundId === id ? "border-[#0B6E4F] bg-[#0B6E4F] text-white" : ""}`}
              onClick={() => persist({ ...prefs, soundId: id, sound: true })}
            >
              {id}
            </button>
          ))}
          <button
            type="button"
            className="rounded-full border px-3 py-1.5 text-sm"
            onClick={() => previewNotificationSound(prefs.soundId)}
          >
            Preview
          </button>
        </div>
      </div>

      <label className="flex items-center justify-between gap-3 text-sm">
        On-screen popups
        <input
          type="checkbox"
          checked={prefs.popups}
          onChange={(event) => persist({ ...prefs, popups: event.target.checked })}
        />
      </label>

      <div className="grid gap-2">
        <label className="flex items-center justify-between gap-3 text-sm">
          Browser tab alerts
          <input type="checkbox" checked={prefs.browser} onChange={(event) => void toggleBrowser(event.target.checked)} />
        </label>
        <p className="text-xs leading-5 text-[var(--lagecto-muted)]">
          We only ask for permission when you turn this on. Alerts can appear while LaGecto is open in a background tab.
          Closed-app push is not claimed here.
        </p>
        {browserNote ? <p className="text-xs text-[var(--lagecto-muted)]">{browserNote}</p> : null}
      </div>

      <label className="flex items-center justify-between gap-3 text-sm">
        Email notifications
        <input
          type="checkbox"
          checked={prefs.email}
          onChange={(event) => persist({ ...prefs, email: event.target.checked })}
        />
      </label>
      <p className="-mt-2 text-xs text-[var(--lagecto-muted)]">Saved on your account. Email delivery stays on the existing LaGecto mail paths.</p>

      <div className="grid gap-2">
        <p className="text-sm font-medium">Quiet hours</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-[var(--lagecto-muted)]">
            From
            <input
              type="time"
              value={prefs.quietStart}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm text-[var(--lagecto-text)]"
              onChange={(event) => persist({ ...prefs, quietStart: event.target.value })}
            />
          </label>
          <label className="text-xs text-[var(--lagecto-muted)]">
            Until
            <input
              type="time"
              value={prefs.quietEnd}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm text-[var(--lagecto-text)]"
              onChange={(event) => persist({ ...prefs, quietEnd: event.target.value })}
            />
          </label>
        </div>
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-medium">Categories</p>
        {CATEGORY_LABELS.map((item) => (
          <label key={item.key} className="flex items-center justify-between gap-3 text-sm">
            {item.label}
            <input
              type="checkbox"
              checked={prefs.categories[item.key]}
              disabled={item.locked}
              onChange={(event) =>
                persist({
                  ...prefs,
                  categories: { ...prefs.categories, [item.key]: event.target.checked },
                })
              }
            />
          </label>
        ))}
      </div>
    </section>
  );
}
