"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDate } from "@/lib/format";
import { DIARY_ART, firstName, greetingForHour, isSameDay, moodMeta, quoteForDay } from "@/lib/diary-visuals";
import { insertDiary } from "@/components/diary/diary-actions";
import { DiaryArt, EmptyDiary, MoodPicker, ProgressBar, QuickAction, RingProgress } from "@/components/diary/diary-ui";

type Row = Record<string, unknown> & { id: string };

export function DiaryHome({
  basePath,
  userName,
  mode,
  allowAdvanced,
  data,
  userId,
}: {
  basePath: string;
  userName?: string | null;
  mode: string;
  allowAdvanced: boolean;
  data: Record<string, Row[]>;
  userId: string;
}) {
  const router = useRouter();
  const now = new Date();
  const greeting = `${greetingForHour(now.getHours())}, ${firstName(userName)}`;
  const todayMood = (data.mood || []).find((row) => isSameDay(String(row.created_at || "")));
  const [savingMood, setSavingMood] = useState(false);
  const [journalDraft, setJournalDraft] = useState("");

  const todayTasks = (data.tasks || []).filter((row) => !row.due_date || isSameDay(String(row.due_date)) || !row.is_done);
  const openToday = todayTasks.filter((row) => !row.is_done);
  const taskDone = (data.tasks || []).filter((row) => row.is_done).length;
  const taskTotal = (data.tasks || []).length;
  const taskRemaining = Math.max(0, taskTotal - taskDone);
  const goalDone = (data.goals || []).filter((row) => Number(row.progress || 0) >= 100).length;
  const goalTotal = (data.goals || []).length;
  const todayEvents = (data.events || []).filter((row) => isSameDay(String(row.event_at || "")));
  const todayGoals = (data.goals || []).filter((row) => !row.target_date || isSameDay(String(row.target_date)) || Number(row.progress) < 100).slice(0, 3);
  const quote = quoteForDay(now);

  const taskPct = taskTotal ? (taskDone / Math.max(taskTotal, 1)) * 100 : 0;
  const goalPct = goalTotal ? (goalDone / goalTotal) * 100 : 0;

  async function setMood(mood: string) {
    if (savingMood) return;
    setSavingMood(true);
    await insertDiary("diary_mood_logs", { user_id: userId, mood });
    setSavingMood(false);
    router.refresh();
  }

  async function quickJournal(event: React.FormEvent) {
    event.preventDefault();
    if (!journalDraft.trim()) return;
    await insertDiary("diary_journal_entries", {
      user_id: userId,
      title: "Today",
      body: journalDraft.trim(),
      mood: todayMood ? String(todayMood.mood) : "good",
    });
    setJournalDraft("");
    router.refresh();
  }

  const dateLabel = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="grid gap-6">
      <section className="lg-card overflow-hidden p-0">
        <div className="grid lg:grid-cols-2">
          <div className="bg-[#0B6E4F] px-5 py-8 text-white sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d4af37]">Smart Diary</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{greeting} 👋</h1>
            <p className="mt-2 text-white/85">How are you doing today?</p>
            <div className="mt-4">
              <MoodPicker value={todayMood ? String(todayMood.mood) : null} onChange={(mood) => void setMood(mood)} />
            </div>
          </div>
          <div className="relative min-h-[10rem]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={DIARY_ART.today} alt="" className="absolute inset-0 h-full w-full object-cover" />
          </div>
        </div>
      </section>

      <section className="lg-card grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--lagecto-muted)]">Today</p>
          <p className="mt-1 text-lg font-semibold">{dateLabel}</p>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-semibold text-[#0B6E4F]">{(data.tasks || []).length}</p>
              <p className="text-[11px] text-[var(--lagecto-muted)]">Tasks</p>
              <p className="text-xs">{taskDone} done · {taskRemaining} left</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-[#0B6E4F]">{goalDone}/{goalTotal || 0}</p>
              <p className="text-[11px] text-[var(--lagecto-muted)]">Goals</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">{todayMood ? moodMeta(String(todayMood.mood)).emoji : "–"}</p>
              <p className="text-[11px] text-[var(--lagecto-muted)]">Mood</p>
              <p className="text-xs">{todayMood ? moodMeta(String(todayMood.mood)).label : "Set it above"}</p>
            </div>
          </div>
        </div>
        <div className="hidden sm:block">
          <RingProgress value={taskPct || goalPct} label="Today" />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <QuickAction href={`${basePath}/journal`} label="Write Journal" art={DIARY_ART.journal} />
        <QuickAction href={`${basePath}/tasks`} label="Add Task" art={DIARY_ART.tasks} />
        <QuickAction href={`${basePath}/calendar`} label="Add Event" art={DIARY_ART.calendar} />
        <QuickAction href={`${basePath}/goals`} label="Add Goal" art={DIARY_ART.goals} />
        {allowAdvanced ? <QuickAction href={`${basePath}/budget`} label="Add Budget" art={DIARY_ART.budget} /> : null}
        <QuickAction href={`${basePath}/motivation`} label="Motivation" art={DIARY_ART.motivation} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="lg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Upcoming tasks</h2>
            <Link href={`${basePath}/tasks`} className="text-sm text-[#0B6E4F]">See all</Link>
          </div>
          {!openToday.length ? (
            <EmptyDiary title="No tasks waiting" body="Add one thing you can finish today." actionHref={`${basePath}/tasks`} actionLabel="Add a task" art={DIARY_ART.tasks} />
          ) : (
            <ul className="grid gap-2">
              {openToday.slice(0, 5).map((row) => (
                <li key={row.id} className="flex items-center justify-between rounded-2xl bg-[#F7F3E3] px-3 py-2 text-sm">
                  <span>{String(row.title)}</span>
                  {row.due_date ? <span className="text-xs text-[var(--lagecto-muted)]">{formatDate(String(row.due_date))}</span> : null}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <ProgressBar value={taskPct} label="Your progress today" />
          </div>
        </article>

        <article className="lg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Calendar & reminders</h2>
            <Link href={`${basePath}/calendar`} className="text-sm text-[#0B6E4F]">Open</Link>
          </div>
          {!todayEvents.length ? (
            <p className="text-sm text-[var(--lagecto-muted)]">Nothing scheduled for today.</p>
          ) : (
            <ul className="grid gap-2">
              {todayEvents.map((row) => (
                <li key={row.id} className="rounded-2xl bg-[#F7F3E3] px-3 py-2 text-sm">
                  {String(row.title)}
                </li>
              ))}
            </ul>
          )}
          <h3 className="mt-4 text-sm font-semibold">Today’s goals</h3>
          {!todayGoals.length ? (
            <p className="mt-1 text-sm text-[var(--lagecto-muted)]">Set a goal to keep today pointed.</p>
          ) : (
            <div className="mt-2 grid gap-3">
              {todayGoals.map((row) => (
                <div key={row.id}>
                  <p className="text-sm font-medium">{String(row.title)}</p>
                  <ProgressBar value={Number(row.progress || 0)} />
                </div>
              ))}
            </div>
          )}
        </article>
      </div>

      <article className="lg-card p-5">
        <h2 className="font-semibold">Quick journal entry</h2>
        <p className="mt-1 text-sm text-[var(--lagecto-muted)]">Write about your day</p>
        <form onSubmit={(event) => void quickJournal(event)} className="mt-3 grid gap-3">
          <textarea
            value={journalDraft}
            onChange={(event) => setJournalDraft(event.target.value)}
            placeholder="Today I…"
            className="min-h-28 rounded-2xl border px-3 py-3"
          />
          <button className="rounded-full bg-[#0B6E4F] px-4 py-3 text-sm font-semibold text-white">Save entry</button>
        </form>
      </article>

      <article className="lg-card flex items-center gap-4 p-5">
        <div className="w-20 shrink-0">
          <DiaryArt src={DIARY_ART.stebo} size={120} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Need help planning your day?</p>
          <p className="text-sm text-[var(--lagecto-muted)]">Ask Stebo — still the same helper, right here in your diary.</p>
          <Link href={allowAdvanced || mode !== "business" ? `${basePath}/chat` : "/shop/stebo"} className="mt-3 inline-flex rounded-full bg-[#0B6E4F] px-4 py-2 text-sm font-semibold text-white">
            Ask Stebo
          </Link>
        </div>
      </article>

      <article className="lg-card overflow-hidden p-0 sm:grid sm:grid-cols-[1fr_160px]">
        <div className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d4af37]">Motivation</p>
          <p className="mt-2 text-lg font-semibold leading-snug">“{quote.text}”</p>
          <Link href={`${basePath}/motivation`} className="mt-3 inline-block text-sm font-medium text-[#0B6E4F]">
            More inspiration
          </Link>
        </div>
        <div className="hidden p-3 sm:block">
          <DiaryArt src={quote.art} size={180} />
        </div>
      </article>

      {mode === "business" ? (
        <Link href={`${basePath}/business`} className="lg-card flex items-center gap-4 p-5">
          <div className="w-20 shrink-0">
            <DiaryArt src={DIARY_ART.business} size={120} />
          </div>
          <div>
            <p className="font-semibold">Business diary</p>
            <p className="text-sm text-[var(--lagecto-muted)]">Goals, notes, ideas, tasks and events for the shop — kept private to you.</p>
          </div>
        </Link>
      ) : null}
    </div>
  );
}
