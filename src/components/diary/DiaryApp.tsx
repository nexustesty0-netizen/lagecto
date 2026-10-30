"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  BookOpen,
  Briefcase,
  Calendar,
  CheckSquare,
  Home,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";
import { ADVANCED_DIARY, DIARY_MODULES, DIARY_PRIMARY, type DiaryMode } from "@/lib/diary";
import { DIARY_ART } from "@/lib/diary-visuals";
import { InsertForm } from "@/components/forms/InsertForm";
import { SteboChat } from "@/components/stebo/SteboChat";
import { DiaryHome } from "@/components/diary/DiaryHome";
import { DiaryJournal } from "@/components/diary/DiaryJournal";
import { DiaryTasks } from "@/components/diary/DiaryTasks";
import { DiaryCalendar } from "@/components/diary/DiaryCalendar";
import { DiaryGoals } from "@/components/diary/DiaryGoals";
import { DiaryBudget } from "@/components/diary/DiaryBudget";
import { DiaryMotivation } from "@/components/diary/DiaryMotivation";
import { DiaryBusiness } from "@/components/diary/DiaryBusiness";
import { DiaryArt, EmptyDiary } from "@/components/diary/diary-ui";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type AnyRow = Record<string, unknown> & { id: string };

const NAV_ICONS: Record<string, typeof Home> = {
  hub: Home,
  journal: BookOpen,
  tasks: CheckSquare,
  calendar: Calendar,
  goals: Target,
  budget: Wallet,
  business: Briefcase,
};

export function DiaryApp({
  basePath,
  mode,
  moduleSlug,
  userId,
  userName,
  allowAdvanced,
  data,
}: {
  basePath: string;
  mode: DiaryMode;
  moduleSlug: string;
  userId: string;
  userName?: string | null;
  allowAdvanced: boolean;
  data: Record<string, AnyRow[]>;
}) {
  const pathname = usePathname();
  const modeLabel = mode === "admin" ? "Admin diary" : mode === "business" ? "Business diary" : "Life diary";
  const modules = DIARY_MODULES.filter((item) => item.slug === "hub" || !ADVANCED_DIARY.has(item.slug) || allowAdvanced);
  const primary = DIARY_PRIMARY.filter((slug) => slug === "hub" || !ADVANCED_DIARY.has(slug) || allowAdvanced);

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <nav className="hide-scrollbar sticky top-[4.25rem] z-20 -mx-1 overflow-x-auto px-1 py-1">
        <div className="flex w-max gap-2">
          {primary.map((slug) => {
            const href = slug === "hub" ? basePath : `${basePath}/${slug}`;
            const active = slug === "hub" ? pathname === basePath : pathname.startsWith(`${basePath}/${slug}`);
            const Icon = NAV_ICONS[slug] || Sparkles;
            const label = DIARY_MODULES.find((item) => item.slug === slug)?.title || slug;
            return (
              <Link
                key={slug}
                href={href}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap ${
                  active ? "bg-[#0B6E4F] text-white" : "bg-white text-[#12241c] ring-1 ring-[var(--lagecto-border)]"
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
      {moduleSlug !== "hub" ? (
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {DIARY_MODULES.find((item) => item.slug === moduleSlug)?.title || "Diary"}
          </h1>
          <p className="mt-1 text-sm text-[var(--lagecto-muted)]">{modeLabel} · private to your account</p>
        </div>
      ) : null}
      {moduleSlug === "hub" ? (
        <DiaryHome basePath={basePath} userName={userName} mode={mode} allowAdvanced={allowAdvanced} data={data} userId={userId} />
      ) : (
        <DiaryModule slug={moduleSlug} userId={userId} data={data} mode={mode} basePath={basePath} />
      )}
      {moduleSlug === "hub" ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--lagecto-muted)]">More in your diary</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {modules
              .filter((item) => !DIARY_PRIMARY.includes(item.slug as (typeof DIARY_PRIMARY)[number]) && item.slug !== "motivation")
              .map((item) => (
                <Link key={item.slug} href={`${basePath}/${item.slug}`} className="lg-card p-4">
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-sm text-[var(--lagecto-muted)]">{item.blurb}</p>
                </Link>
              ))}
            <Link href={`${basePath}/motivation`} className="lg-card p-4">
              <p className="font-semibold">Motivation</p>
              <p className="text-sm text-[var(--lagecto-muted)]">A spark for the day</p>
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function DiaryModule({
  slug,
  userId,
  data,
  mode,
  basePath,
}: {
  slug: string;
  userId: string;
  data: Record<string, AnyRow[]>;
  mode: DiaryMode;
  basePath: string;
}) {
  const extra = { user_id: userId };
  if (slug === "journal") return <DiaryJournal rows={data.journal || []} userId={userId} />;
  if (slug === "write") return <DiaryJournal rows={data.journal || []} userId={userId} />;
  if (slug === "tasks") return <DiaryTasks rows={data.tasks || []} userId={userId} />;
  if (slug === "calendar") {
    return <DiaryCalendar events={data.events || []} tasks={data.tasks || []} goals={data.goals || []} userId={userId} />;
  }
  if (slug === "goals") return <DiaryGoals rows={data.goals || []} userId={userId} />;
  if (slug === "growth") return <DiaryGoals rows={data.goals || []} userId={userId} title="Growth" />;
  if (slug === "budget") return <DiaryBudget rows={data.budget || []} userId={userId} />;
  if (slug === "motivation") return <DiaryMotivation />;
  if (slug === "business") return <DiaryBusiness basePath={basePath} />;
  if (slug === "chat") {
    return (
      <section className="grid gap-4">
        <article className="lg-card flex items-center gap-4 p-5">
          <div className="w-16 shrink-0">
            <DiaryArt src={DIARY_ART.stebo} size={96} />
          </div>
          <div>
            <p className="font-semibold">Need help planning your day?</p>
            <p className="text-sm text-[var(--lagecto-muted)]">Ask Stebo. This is the same helper, sitting inside your diary.</p>
          </div>
        </article>
        <SteboChat mode="diary" title="Stebo in Smart Diary" />
      </section>
    );
  }
  if (slug === "habits") {
    return (
      <ModuleFrame title="Habits">
        <InsertForm
          table="diary_habits"
          extra={extra}
          className="lg-card grid gap-3 p-5 sm:grid-cols-2"
          fields={[{ name: "title", placeholder: "Habit", required: true }]}
        />
        <HabitList rows={data.habits || []} />
      </ModuleFrame>
    );
  }
  if (slug === "mood") {
    return (
      <ModuleFrame title="Mood">
        <InsertForm
          table="diary_mood_logs"
          extra={extra}
          className="lg-card grid gap-3 p-5"
          fields={[
            { name: "mood", placeholder: "Mood", required: true, options: ["great", "good", "okay", "low", "rough"].map((value) => ({ value, label: value })) },
            { name: "note", placeholder: "Note" },
          ]}
        />
        <List
          rows={data.mood}
          empty={<EmptyDiary title="How did today feel?" body="Log a mood whenever you want a record." art={DIARY_ART.growth} />}
          render={(row) => (
            <p>
              {String(row.mood)} — {String(row.note || "")}
            </p>
          )}
        />
      </ModuleFrame>
    );
  }
  if (slug === "vision") {
    return (
      <ModuleFrame title="Vision">
        <InsertForm
          table="diary_vision_items"
          extra={extra}
          className="lg-card grid gap-3 p-5"
          fields={[
            { name: "title", placeholder: "Vision", required: true },
            { name: "notes", type: "textarea", placeholder: "Notes" },
          ]}
        />
        <List
          rows={data.vision}
          empty={<EmptyDiary title="Name the future" body="Add the picture you are walking toward." art={DIARY_ART.goals} />}
          render={(row) => (
            <p>
              <strong>{String(row.title)}</strong>
              <br />
              {String(row.notes || "")}
            </p>
          )}
        />
      </ModuleFrame>
    );
  }
  if (slug === "memory") {
    return (
      <ModuleFrame title="Memory">
        <InsertForm
          table="diary_memories"
          extra={extra}
          className="lg-card grid gap-3 p-5"
          fields={[
            { name: "title", placeholder: "Title" },
            { name: "body", type: "textarea", required: true, placeholder: "Memory" },
          ]}
        />
        <List
          rows={data.memories}
          empty={<EmptyDiary title="Keep a moment" body="Save something you do not want to lose." art={DIARY_ART.empty} />}
          render={(row) => (
            <p>
              <strong>{String(row.title || "Memory")}</strong>
              <br />
              {String(row.body)}
            </p>
          )}
        />
      </ModuleFrame>
    );
  }
  if (slug === "briefing") {
    return (
      <ModuleFrame title="Briefing">
        <InsertForm
          table="diary_briefings"
          extra={extra}
          className="lg-card grid gap-3 p-5"
          fields={[{ name: "content", type: "textarea", required: true, placeholder: `${mode} briefing` }]}
        />
        <List rows={data.briefings} empty={<EmptyDiary title="Start the day on paper" body="A short briefing is enough." art={DIARY_ART.today} />} render={(row) => <p>{String(row.content)}</p>} />
      </ModuleFrame>
    );
  }
  if (slug === "reflections") {
    return (
      <ModuleFrame title="Reflections">
        <InsertForm
          table="diary_reflections"
          extra={extra}
          className="lg-card grid gap-3 p-5"
          fields={[
            { name: "prompt", placeholder: "Prompt" },
            { name: "body", type: "textarea", required: true, placeholder: "Reflection" },
          ]}
        />
        <List
          rows={data.reflections}
          empty={<EmptyDiary title="Ask yourself something true" body="Write a prompt, then answer it." art={DIARY_ART.journal} />}
          render={(row) => (
            <p>
              <strong>{String(row.prompt || "")}</strong>
              <br />
              {String(row.body)}
            </p>
          )}
        />
      </ModuleFrame>
    );
  }
  if (slug === "weekly") {
    return (
      <ModuleFrame title="Weekly review">
        <InsertForm
          table="diary_weekly_reviews"
          extra={extra}
          className="lg-card grid gap-3 p-5"
          fields={[
            { name: "week_start", type: "date" },
            { name: "body", type: "textarea", required: true, placeholder: "How did the week go?" },
          ]}
        />
        <List rows={data.weekly} empty={<EmptyDiary title="Look back kindly" body="Write a weekly review when you are ready." art={DIARY_ART.growth} />} render={(row) => <p>{String(row.body)}</p>} />
      </ModuleFrame>
    );
  }
  if (slug === "timeline" || slug === "insights") {
    const mixed = [
      ...(data.journal || []).map((row) => ({ ...row, kind: "journal" })),
      ...(data.mood || []).map((row) => ({ ...row, kind: "mood" })),
      ...(data.memories || []).map((row) => ({ ...row, kind: "memory" })),
    ].slice(0, 30);
    return (
      <ModuleFrame title={slug === "insights" ? "Insights" : "Timeline"}>
        {slug === "insights" ? (
          <p className="text-sm text-[var(--lagecto-muted)]">
            {data.journal?.length || 0} journal notes, {data.tasks?.length || 0} tasks, {data.habits?.length || 0} habits.
          </p>
        ) : null}
        <List
          rows={mixed}
          empty={<EmptyDiary title="Your history will gather here" body="Write, log a mood, or save a memory." art={DIARY_ART.empty} />}
          render={(row) => (
            <p>
              {String(row.kind)} · {String(row.title || row.mood || row.body || "").slice(0, 140)}
            </p>
          )}
        />
      </ModuleFrame>
    );
  }
  return <p>Unknown diary module.</p>;
}

function ModuleFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function List({
  rows,
  render,
  empty,
}: {
  rows?: AnyRow[];
  render: (row: AnyRow) => React.ReactNode;
  empty?: React.ReactNode;
}) {
  if (!rows?.length) return <>{empty || <p className="text-sm text-[var(--lagecto-muted)]">Nothing here yet.</p>}</>;
  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <article key={row.id} className="lg-card p-4 text-sm">
          {render(row)}
        </article>
      ))}
    </div>
  );
}

function HabitList({ rows }: { rows: AnyRow[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  async function log(habitId: string) {
    const supabase = createBrowserSupabase();
    const { error: insertError } = await supabase.from("diary_habit_logs").insert({ habit_id: habitId });
    if (insertError) setError("Already logged today.");
    else router.refresh();
  }
  if (!rows.length) return <EmptyDiary title="Build a quiet streak" body="Add a habit, then tap to log today." art={DIARY_ART.growth} />;
  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <button key={row.id} type="button" onClick={() => void log(row.id)} className="lg-card p-4 text-left">
          {String(row.title)} · log today
        </button>
      ))}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
