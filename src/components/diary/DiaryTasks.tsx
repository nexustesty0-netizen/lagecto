"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatDate } from "@/lib/format";
import { DIARY_ART, TASK_PRIORITIES } from "@/lib/diary-visuals";
import { deleteDiary, insertDiary, updateDiary } from "@/components/diary/diary-actions";
import { EmptyDiary, ProgressBar } from "@/components/diary/diary-ui";

type Row = Record<string, unknown> & { id: string };

export function DiaryTasks({ rows, userId }: { rows: Row[]; userId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState("normal");
  const [category, setCategory] = useState("");
  const [pop, setPop] = useState<string | null>(null);

  const done = rows.filter((row) => row.is_done).length;
  const pct = rows.length ? (done / rows.length) * 100 : 0;
  const open = useMemo(() => rows.filter((row) => !row.is_done), [rows]);
  const complete = useMemo(() => rows.filter((row) => row.is_done), [rows]);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    await insertDiary("diary_tasks", {
      user_id: userId,
      title: title.trim(),
      due_date: due || null,
      priority,
      category: category.trim() || null,
    });
    setTitle("");
    setDue("");
    setCategory("");
    router.refresh();
  }

  async function toggle(row: Row) {
    setPop(row.id);
    await updateDiary("diary_tasks", row.id, { is_done: !row.is_done });
    router.refresh();
  }

  return (
    <div className="grid gap-5">
      <section className="lg-card p-5">
        <h2 className="font-semibold">Your progress today</h2>
        <p className="mt-1 text-sm text-[var(--lagecto-muted)]">
          {done} of {rows.length} complete
        </p>
        <div className="mt-3">
          <ProgressBar value={pct} />
        </div>
      </section>
      <form onSubmit={(event) => void add(event)} className="lg-card grid gap-3 p-5">
        <input value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="Task name" className="rounded-2xl border px-3 py-3" />
        <div className="grid gap-3 sm:grid-cols-3">
          <input type="date" value={due} onChange={(event) => setDue(event.target.value)} className="rounded-2xl border px-3 py-3" />
          <select value={priority} onChange={(event) => setPriority(event.target.value)} className="rounded-2xl border px-3 py-3">
            {TASK_PRIORITIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label} priority
              </option>
            ))}
          </select>
          <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Category" className="rounded-2xl border px-3 py-3" />
        </div>
        <button className="rounded-full bg-[#0B6E4F] px-4 py-3 text-sm font-semibold text-white">Add task</button>
      </form>
      {!rows.length ? (
        <EmptyDiary title="A clear list starts here" body="Add your first task and check it off." art={DIARY_ART.tasks} />
      ) : (
        <div className="grid gap-2">
          {open.map((row) => (
            <TaskRow key={row.id} row={row} popped={pop === row.id} onToggle={() => void toggle(row)} onDelete={() => void deleteDiary("diary_tasks", row.id).then(() => router.refresh())} />
          ))}
          {complete.map((row) => (
            <TaskRow key={row.id} row={row} popped={pop === row.id} onToggle={() => void toggle(row)} onDelete={() => void deleteDiary("diary_tasks", row.id).then(() => router.refresh())} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({
  row,
  popped,
  onToggle,
  onDelete,
}: {
  row: Row;
  popped: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const done = Boolean(row.is_done);
  return (
    <article className={`lg-card flex items-center gap-3 p-4 ${done ? "opacity-70" : ""} ${popped ? "diary-check-done" : ""}`}>
      <button
        type="button"
        onClick={onToggle}
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border ${done ? "bg-[#0B6E4F] text-white" : "bg-white"}`}
        aria-label={done ? "Mark incomplete" : "Complete task"}
      >
        {done ? "✓" : ""}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`font-medium ${done ? "line-through" : ""}`}>{String(row.title)}</p>
        <p className="text-xs text-[var(--lagecto-muted)]">
          {row.priority ? `${String(row.priority)} · ` : ""}
          {row.category ? `${String(row.category)} · ` : ""}
          {row.due_date ? `Due ${formatDate(String(row.due_date))}` : "No due date"}
        </p>
      </div>
      <button type="button" onClick={onDelete} className="text-xs text-[#C2413B]">
        Delete
      </button>
    </article>
  );
}
