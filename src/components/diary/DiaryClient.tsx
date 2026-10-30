"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Entry = { id: string; title: string | null; body: string; created_at: string };
type Task = { id: string; title: string; is_done: boolean };
type Goal = { id: string; title: string; progress: number };

export function DiaryClient({
  entries,
  tasks,
  goals,
}: {
  entries: Entry[];
  tasks: Task[];
  goals: Goal[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function addJournal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const supabase = createBrowserSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error: insertError } = await supabase.from("diary_journal_entries").insert({
      user_id: user?.id,
      title: String(form.get("title") || ""),
      body: String(form.get("body") || ""),
    });
    if (insertError) setError("Unable to save this entry.");
    else {
      event.currentTarget.reset();
      router.refresh();
    }
  }

  async function addTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const supabase = createBrowserSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("diary_tasks").insert({ user_id: user?.id, title: String(form.get("title") || "") });
    event.currentTarget.reset();
    router.refresh();
  }

  async function addGoal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const supabase = createBrowserSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("diary_goals").insert({ user_id: user?.id, title: String(form.get("title") || "") });
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="rounded-2xl bg-white p-4 lg:col-span-2">
        <h2 className="font-semibold">Journal</h2>
        <form onSubmit={addJournal} className="mt-3 grid gap-2">
          <input name="title" placeholder="Title" className="rounded-xl border px-3 py-2" />
          <textarea name="body" required placeholder="Write..." className="min-h-24 rounded-xl border px-3 py-2" />
          <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Save entry</button>
        </form>
        <div className="mt-4 grid gap-3">
          {entries.map((entry) => (
            <article key={entry.id} className="rounded-xl bg-[#F7F3E3] p-3">
              <p className="font-medium">{entry.title || "Untitled"}</p>
              <p className="text-sm text-[#6B7280]">{entry.body}</p>
            </article>
          ))}
        </div>
      </section>
      <div className="grid gap-6">
        <section className="rounded-2xl bg-white p-4">
          <h2 className="font-semibold">Tasks</h2>
          <form onSubmit={addTask} className="mt-3 flex gap-2">
            <input name="title" required className="flex-1 rounded-xl border px-3 py-2" />
            <button className="rounded-xl bg-[#0B6E4F] px-3 text-white">Add</button>
          </form>
          <ul className="mt-3 grid gap-2 text-sm">
            {tasks.map((task) => (
              <li key={task.id}>{task.title}</li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl bg-white p-4">
          <h2 className="font-semibold">Goals</h2>
          <form onSubmit={addGoal} className="mt-3 flex gap-2">
            <input name="title" required className="flex-1 rounded-xl border px-3 py-2" />
            <button className="rounded-xl bg-[#0B6E4F] px-3 text-white">Add</button>
          </form>
          <ul className="mt-3 grid gap-2 text-sm">
            {goals.map((goal) => (
              <li key={goal.id}>
                {goal.title} · {goal.progress}%
              </li>
            ))}
          </ul>
        </section>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
