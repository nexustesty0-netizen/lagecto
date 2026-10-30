"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";

type InboxItem = {
  id: string;
  title: string;
  message: string;
  type?: string | null;
  href?: string | null;
  created_at: string;
};

function canPlaySound() {
  return typeof window !== "undefined" && window.localStorage.getItem("lg-sound") !== "off" && window.localStorage.getItem("lg-interacted") === "1";
}

function playSoftChime(kind: string) {
  if (!canPlaySound()) return;
  const prefs = window.localStorage.getItem("lg-sound-kinds") || "message,order,announcement,achievement,support";
  if (kind && !prefs.split(",").includes(kind) && kind !== "general") return;
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 784;
  gain.gain.value = 0.04;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.12);
  osc.onended = () => void ctx.close();
}

export function NotificationCenter() {
  const router = useRouter();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [home, setHome] = useState("/customer/notifications");
  const [toast, setToast] = useState<InboxItem | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  useEffect(() => {
    function markInteracted() {
      window.localStorage.setItem("lg-interacted", "1");
    }
    window.addEventListener("pointerdown", markInteracted, { once: true });
    return () => window.removeEventListener("pointerdown", markInteracted);
  }, []);

  useEffect(() => {
    let timer: number;
    async function load() {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const next: InboxItem[] = data.items || [];
      setHome(data.home || "/customer/notifications");
      if (primed.current) {
        const fresh = next.find((item) => !seen.current.has(item.id));
        if (fresh) {
          setToast(fresh);
          playSoftChime(String(fresh.type || "general"));
          window.setTimeout(() => setToast((current) => (current?.id === fresh.id ? null : current)), 6000);
        }
      }
      primed.current = true;
      seen.current = new Set(next.map((item) => item.id));
      setItems(next);
    }
    void load();
    timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="relative">
      <Link
        href={home}
        className="relative grid h-11 w-11 place-items-center rounded-full border border-[var(--lagecto-border)] bg-white"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {items.length ? (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#C2413B] px-1 text-[10px] font-semibold text-white">
            {items.length > 9 ? "9+" : items.length}
          </span>
        ) : null}
      </Link>
      {toast ? (
        <div className="lg-toast absolute right-0 top-12 z-40 w-[min(18rem,calc(100vw-1.5rem))] os-surface p-3">
          <p className="text-sm font-semibold">{toast.title}</p>
          <p className="mt-1 text-sm text-[var(--lagecto-muted)]">{toast.message}</p>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" className="text-xs" onClick={() => setToast(null)}>
              Dismiss
            </button>
            <button
              type="button"
              className="text-xs font-semibold text-[#0B6E4F]"
              onClick={() => {
                const href = toast.href || home;
                setToast(null);
                router.push(href);
              }}
            >
              Open
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function NotificationPrefs() {
  const [sound, setSound] = useState(true);
  const [kinds, setKinds] = useState({ message: true, order: true, announcement: true, achievement: true, support: true });

  useEffect(() => {
    setSound(window.localStorage.getItem("lg-sound") !== "off");
    const stored = window.localStorage.getItem("lg-sound-kinds");
    if (stored) {
      setKinds({
        message: stored.includes("message"),
        order: stored.includes("order"),
        announcement: stored.includes("announcement"),
        achievement: stored.includes("achievement"),
        support: stored.includes("support") || stored === "message,order,announcement,achievement",
      });
    }
  }, []);

  function persist(nextSound: boolean, nextKinds: typeof kinds) {
    window.localStorage.setItem("lg-sound", nextSound ? "on" : "off");
    window.localStorage.setItem(
      "lg-sound-kinds",
      Object.entries(nextKinds)
        .filter(([, on]) => on)
        .map(([key]) => key)
        .join(","),
    );
    void fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preferences: {
          sound: nextSound,
          messageSound: nextKinds.message,
          orderSound: nextKinds.order,
          announcementSound: nextKinds.announcement,
          achievementSound: nextKinds.achievement,
          support: nextKinds.support,
          supportSound: nextKinds.support,
        },
      }),
    });
  }

  return (
    <section className="os-surface grid max-w-lg gap-3">
      <h2 className="font-semibold">Notification sounds</h2>
      <p className="text-sm text-[var(--lagecto-muted)]">Sounds play only after you tap the app, because browsers block autoplay.</p>
      <label className="flex items-center justify-between gap-3 text-sm">
        Sound
        <input
          type="checkbox"
          checked={sound}
          onChange={(event) => {
            const next = event.target.checked;
            setSound(next);
            persist(next, kinds);
          }}
        />
      </label>
      {(["message", "order", "announcement", "achievement", "support"] as const).map((key) => (
        <label key={key} className="flex items-center justify-between gap-3 text-sm">
          {key} alerts
          <input
            type="checkbox"
            checked={kinds[key]}
            onChange={(event) => {
              const next = { ...kinds, [key]: event.target.checked };
              setKinds(next);
              persist(sound, next);
            }}
          />
        </label>
      ))}
    </section>
  );
}
