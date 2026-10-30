"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import {
  WEEKDAYS,
  parseOpeningHours,
  shopIsOpenNow,
  type DayHours,
  type OpeningHours,
} from "@/lib/hours";

export function HoursEditor({
  shopId,
  openingHours,
  autoClose,
  isOpen,
}: {
  shopId: string;
  openingHours?: unknown;
  autoClose?: boolean | null;
  isOpen?: boolean | null;
}) {
  const [hours, setHours] = useState<OpeningHours>(() => parseOpeningHours(openingHours));
  const [followHours, setFollowHours] = useState(autoClose !== false);
  const [forceOpen, setForceOpen] = useState(Boolean(isOpen));
  const [message, setMessage] = useState("");

  function patchDay(key: (typeof WEEKDAYS)[number]["key"], next: Partial<DayHours>) {
    setHours((current) => ({
      ...current,
      days: { ...current.days, [key]: { ...current.days[key], ...next } },
    }));
  }

  function copyMonday() {
    const monday = hours.days.mon;
    setHours((current) => ({
      ...current,
      days: {
        ...current.days,
        tue: { ...monday },
        wed: { ...monday },
        thu: { ...monday },
        fri: { ...monday },
      },
    }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const supabase = createBrowserSupabase();
    const payload = { timezone: hours.timezone, days: hours.days };
    const computed = shopIsOpenNow({ opening_hours: payload, auto_close: followHours, is_open: forceOpen });
    const { error } = await supabase
      .from("shops")
      .update({
        opening_hours: payload,
        auto_close: followHours,
        is_open: followHours ? computed : forceOpen,
      })
      .eq("id", shopId);
    setMessage(error ? "Unable to save hours." : "Business hours saved. Open/closed now follows this schedule.");
  }

  const live = shopIsOpenNow({ opening_hours: hours, auto_close: followHours, is_open: forceOpen });

  return (
    <form onSubmit={save} className="lg-card grid gap-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Business hours</h2>
        <span className={`badge ${live ? "bg-emerald-50 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>
          {live ? "Open now" : "Closed now"}
        </span>
      </div>
      <p className="text-sm text-[#6B7280]">Times use Zimbabwe time (Africa/Harare). Customers see Open or Closed from this schedule.</p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={followHours} onChange={(event) => setFollowHours(event.target.checked)} />
        Open and close automatically from these hours
      </label>
      {!followHours ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={forceOpen} onChange={(event) => setForceOpen(event.target.checked)} />
          Shop is open (manual)
        </label>
      ) : null}
      <button type="button" className="w-fit text-sm font-semibold text-[#0B6E4F]" onClick={copyMonday}>
        Copy Monday to weekdays
      </button>
      <div className="grid gap-2">
        {WEEKDAYS.map((day) => {
          const slot = hours.days[day.key];
          return (
            <div key={day.key} className="grid gap-2 rounded-xl border px-3 py-2 sm:grid-cols-[7rem_auto_1fr_1fr]">
              <p className="self-center text-sm font-medium">{day.label}</p>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={slot.closed} onChange={(event) => patchDay(day.key, { closed: event.target.checked })} />
                Closed
              </label>
              <input
                type="time"
                value={slot.open}
                disabled={slot.closed}
                onChange={(event) => patchDay(day.key, { open: event.target.value })}
                className="rounded-lg border px-2 py-1 text-sm disabled:opacity-50"
              />
              <input
                type="time"
                value={slot.close}
                disabled={slot.closed}
                onChange={(event) => patchDay(day.key, { close: event.target.value })}
                className="rounded-lg border px-2 py-1 text-sm disabled:opacity-50"
              />
            </div>
          );
        })}
      </div>
      <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Save hours</button>
      {message ? <p className="text-sm text-[#0B6E4F]">{message}</p> : null}
    </form>
  );
}
