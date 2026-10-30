"use client";

import { useState } from "react";
import { SteboChat } from "@/components/stebo/SteboChat";
import { InsertForm } from "@/components/forms/InsertForm";

const MODES = [
  { id: "general", label: "General" },
  { id: "marketing", label: "Marketing" },
  { id: "sales", label: "Sales" },
  { id: "inventory", label: "Inventory" },
  { id: "customers", label: "Customers" },
];

export function ShopSteboHub({
  userId,
  goals,
  briefings,
  reports,
  weekly = [],
}: {
  userId: string;
  goals: { id: string; title: string; notes: string | null }[];
  briefings: { id: string; content: string }[];
  reports: { id: string; title: string; body: string }[];
  weekly?: { id: string; week_start: string; title: string; body: string; generated_at: string }[];
}) {
  const [mode, setMode] = useState("general");
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap gap-2">
        {MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setMode(item.id)}
            className={`rounded-full px-3 py-1 text-sm ${mode === item.id ? "bg-[#0B6E4F] text-white" : "bg-white"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <SteboChat mode={`business-${mode}`} title={`Stebo · ${mode}`} />
      {weekly.length ? (
        <section>
          <h2 className="mb-3 font-semibold">Weekend analytics</h2>
          <div className="grid gap-3">
            {weekly.map((row) => (
              <article key={row.id} className="rounded-2xl bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-[#D4AF37]">Week of {row.week_start}</p>
                <p className="mt-1 font-semibold">{row.title}</p>
                <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-[#12241c]">{row.body}</pre>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <p className="text-sm text-[#6B7280]">Weekend analytics appear after the Saturday job runs. Stebo will not invent numbers if there is no activity.</p>
      )}
      <section>
        <h2 className="mb-3 font-semibold">Goals</h2>
        <InsertForm table="stebo_goals" extra={{ user_id: userId }} fields={[{ name: "title", required: true, placeholder: "Goal" }, { name: "notes", placeholder: "Notes" }]} />
        <div className="mt-3 grid gap-2">
          {goals.map((row) => (
            <article key={row.id} className="rounded-2xl bg-white p-4">
              <p className="font-semibold">{row.title}</p>
              <p className="text-sm text-[#6B7280]">{row.notes}</p>
            </article>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-3 font-semibold">Briefings</h2>
        <InsertForm table="stebo_briefings" extra={{ user_id: userId }} fields={[{ name: "content", type: "textarea", required: true, placeholder: "Briefing" }]} />
        <div className="mt-3 grid gap-2">
          {briefings.map((row) => (
            <article key={row.id} className="rounded-2xl bg-white p-4 text-sm">
              {row.content}
            </article>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-3 font-semibold">Reports</h2>
        <InsertForm
          table="stebo_reports"
          extra={{ user_id: userId }}
          fields={[
            { name: "title", required: true, placeholder: "Title" },
            { name: "body", type: "textarea", required: true, placeholder: "Report" },
          ]}
        />
        <div className="mt-3 grid gap-2">
          {reports.map((row) => (
            <article key={row.id} className="rounded-2xl bg-white p-4">
              <p className="font-semibold">{row.title}</p>
              <p className="text-sm text-[#6B7280]">{row.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
