"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import { DIARY_ART, toDateKey } from "@/lib/diary-visuals";
import { deleteDiary, insertDiary } from "@/components/diary/diary-actions";
import { EmptyDiary } from "@/components/diary/diary-ui";

type Row = Record<string, unknown> & { id: string };

export function DiaryCalendar({
  events,
  tasks,
  goals,
  userId,
}: {
  events: Row[];
  tasks: Row[];
  goals: Row[];
  userId: string;
}) {
  const router = useRouter();
  const [cursor, setCursor] = useState(() => new Date());
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [notes, setNotes] = useState("");

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const start = first.getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = useMemo(() => {
    const list: (number | null)[] = [...Array(start).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
    while (list.length % 7) list.push(null);
    return list;
  }, [start, days]);

  const marks = useMemo(() => {
    const map = new Map<string, { events: number; tasks: number; goals: number }>();
    const bump = (key: string, field: "events" | "tasks" | "goals") => {
      if (!key) return;
      const cur = map.get(key) || { events: 0, tasks: 0, goals: 0 };
      cur[field] += 1;
      map.set(key, cur);
    };
    for (const row of events) bump(toDateKey(String(row.event_at || "")), "events");
    for (const row of tasks) bump(toDateKey(String(row.due_date || "")), "tasks");
    for (const row of goals) bump(toDateKey(String(row.target_date || "")), "goals");
    return map;
  }, [events, tasks, goals]);

  const monthLabel = cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const selectedKey = toDateKey(new Date());
  const upcoming = [...events].sort((a, b) => String(a.event_at).localeCompare(String(b.event_at))).slice(0, 8);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !when) return;
    await insertDiary("diary_events", {
      user_id: userId,
      title: title.trim(),
      event_at: new Date(when).toISOString(),
      notes: notes.trim() || null,
    });
    setTitle("");
    setWhen("");
    setNotes("");
    router.refresh();
  }

  return (
    <div className="grid gap-5">
      <section className="lg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <button type="button" className="rounded-full px-3 py-1 text-sm" onClick={() => setCursor(new Date(year, month - 1, 1))}>
            Prev
          </button>
          <h2 className="font-semibold">{monthLabel}</h2>
          <button type="button" className="rounded-full px-3 py-1 text-sm" onClick={() => setCursor(new Date(year, month + 1, 1))}>
            Next
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-[var(--lagecto-muted)]">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day}>{day[0]}</div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {cells.map((day, index) => {
            if (!day) return <div key={`e-${index}`} />;
            const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const mark = marks.get(key);
            const isToday = key === selectedKey;
            return (
              <div
                key={key}
                className={`min-h-14 rounded-2xl p-1 text-sm ${isToday ? "bg-[#0B6E4F] text-white" : "bg-[#F7F3E3]"}`}
              >
                <p className="text-xs font-semibold">{day}</p>
                <div className="mt-1 flex justify-center gap-0.5">
                  {mark?.events ? <span className={`h-1.5 w-1.5 rounded-full ${isToday ? "bg-[#d4af37]" : "bg-[#0B6E4F]"}`} /> : null}
                  {mark?.tasks ? <span className={`h-1.5 w-1.5 rounded-full ${isToday ? "bg-white" : "bg-[#2E8B57]"}`} /> : null}
                  {mark?.goals ? <span className={`h-1.5 w-1.5 rounded-full ${isToday ? "bg-[#d4af37]" : "bg-[#C47B12]"}`} /> : null}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-[var(--lagecto-muted)]">Green · events · Sage · tasks · Gold · goals</p>
      </section>

      <form onSubmit={(event) => void add(event)} className="lg-card grid gap-3 p-5">
        <h2 className="font-semibold">Add event</h2>
        <input value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="Event" className="rounded-2xl border px-3 py-3" />
        <input type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} required className="rounded-2xl border px-3 py-3" />
        <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes / reminder" className="rounded-2xl border px-3 py-3" />
        <button className="rounded-full bg-[#0B6E4F] px-4 py-3 text-sm font-semibold text-white">Save event</button>
      </form>

      {!upcoming.length ? (
        <EmptyDiary title="Your calendar is clear" body="Add an event so the month can light up." art={DIARY_ART.calendar} />
      ) : (
        <div className="grid gap-2">
          {upcoming.map((row) => (
            <article key={row.id} className="lg-card flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{String(row.title)}</p>
                <p className="text-xs text-[var(--lagecto-muted)]">{formatDateTime(String(row.event_at || ""))}</p>
                {row.notes ? <p className="text-sm">{String(row.notes)}</p> : null}
              </div>
              <button type="button" className="text-xs text-[#C2413B]" onClick={() => void deleteDiary("diary_events", row.id).then(() => router.refresh())}>
                Delete
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
