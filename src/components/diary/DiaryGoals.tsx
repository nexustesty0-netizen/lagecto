"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDate } from "@/lib/format";
import { DIARY_ART, GOAL_CATEGORIES } from "@/lib/diary-visuals";
import { deleteDiary, insertDiary, updateDiary } from "@/components/diary/diary-actions";
import { DiaryArt, EmptyDiary, ProgressBar } from "@/components/diary/diary-ui";

type Row = Record<string, unknown> & { id: string };

export function DiaryGoals({ rows, userId, title = "Goals" }: { rows: Row[]; userId: string; title?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState("personal");
  const [target, setTarget] = useState("");
  const [milestones, setMilestones] = useState("");

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    await insertDiary("diary_goals", {
      user_id: userId,
      title: name.trim(),
      notes: notes.trim() || null,
      category,
      target_date: target || null,
      milestones: milestones.trim() || null,
      progress: 0,
    });
    setName("");
    setNotes("");
    setMilestones("");
    router.refresh();
  }

  return (
    <div className="grid gap-5">
      <form onSubmit={(event) => void add(event)} className="lg-card grid gap-3 p-5">
        <h2 className="font-semibold">New {title.toLowerCase()}</h2>
        <input value={name} onChange={(event) => setName(event.target.value)} required placeholder="Goal title" className="rounded-2xl border px-3 py-3" />
        <div className="flex flex-wrap gap-2">
          {GOAL_CATEGORIES.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setCategory(item.value)}
              className={`rounded-full px-3 py-1.5 text-sm ${category === item.value ? "bg-[#0B6E4F] text-white" : "bg-white ring-1 ring-[var(--lagecto-border)]"}`}
            >
              {item.emoji} {item.label}
            </button>
          ))}
        </div>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Description" className="min-h-20 rounded-2xl border px-3 py-3" />
        <input type="date" value={target} onChange={(event) => setTarget(event.target.value)} className="rounded-2xl border px-3 py-3" />
        <textarea value={milestones} onChange={(event) => setMilestones(event.target.value)} placeholder="Milestones, one per line" className="min-h-20 rounded-2xl border px-3 py-3" />
        <button className="rounded-full bg-[#0B6E4F] px-4 py-3 text-sm font-semibold text-white">Add goal</button>
      </form>
      {!rows.length ? (
        <EmptyDiary title="Aim at something kind" body="Create a goal and watch the bar fill." art={DIARY_ART.goals} />
      ) : (
        <div className="grid gap-3">
          {rows.map((row) => {
            const pct = Number(row.progress || 0);
            const cat = GOAL_CATEGORIES.find((item) => item.value === row.category);
            const done = pct >= 100;
            const steps = String(row.milestones || "")
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean);
            return (
              <article key={row.id} className="lg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{String(row.title)}</p>
                    <p className="text-xs text-[var(--lagecto-muted)]">
                      {cat ? `${cat.emoji} ${cat.label}` : "✨ Other"}
                      {row.target_date ? ` · ${formatDate(String(row.target_date))}` : ""}
                    </p>
                  </div>
                  {done ? (
                    <span className="w-14">
                      <DiaryArt src={DIARY_ART.success} size={80} />
                    </span>
                  ) : null}
                </div>
                {row.notes ? <p className="mt-2 text-sm">{String(row.notes)}</p> : null}
                <div className="mt-3">
                  <ProgressBar value={pct} />
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={pct}
                  onChange={(event) => void updateDiary("diary_goals", row.id, { progress: Number(event.target.value) }).then(() => router.refresh())}
                  className="mt-2 w-full"
                  aria-label={`Progress for ${String(row.title)}`}
                />
                {steps.length ? (
                  <ul className="mt-3 grid gap-1 text-sm">
                    {steps.map((step) => (
                      <li key={step}>• {step}</li>
                    ))}
                  </ul>
                ) : null}
                <button type="button" className="mt-3 text-xs text-[#C2413B]" onClick={() => void deleteDiary("diary_goals", row.id).then(() => router.refresh())}>
                  Delete
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
