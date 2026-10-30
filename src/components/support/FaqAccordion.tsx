"use client";

import { FAQ_SECTION_LABELS } from "@/lib/support/constants";
import type { FaqRow } from "@/lib/support/load";
import { useEffect, useMemo, useState } from "react";

export function FaqAccordion({ faqs }: { faqs: FaqRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const sections = useMemo(() => [...new Set(faqs.map((row) => row.section))], [faqs]);
  const visible = faqs.filter((row) => filter === "all" || row.section === filter);

  useEffect(() => {
    const id = window.location.hash.replace("#", "");
    if (id) setOpen(id);
  }, []);

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        <button type="button" className={`rounded-full px-4 py-2 text-sm ${filter === "all" ? "bg-[#0B6E4F] text-white" : "border bg-white"}`} onClick={() => setFilter("all")}>
          All
        </button>
        {sections.map((section) => (
          <button
            key={section}
            type="button"
            className={`rounded-full px-4 py-2 text-sm ${filter === section ? "bg-[#0B6E4F] text-white" : "border bg-white"}`}
            onClick={() => setFilter(section)}
          >
            {FAQ_SECTION_LABELS[section] || section}
          </button>
        ))}
      </div>
      <div className="grid gap-3">
        {visible.map((faq) => {
          const expanded = open === faq.id;
          return (
            <article key={faq.id} id={faq.id} className="lg-card overflow-hidden">
              <h3>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : faq.id)}
                >
                  {faq.question}
                  <span aria-hidden className="text-[#0B6E4F]">
                    {expanded ? "–" : "+"}
                  </span>
                </button>
              </h3>
              <div className={`grid transition-[grid-template-rows] duration-300 ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <p className="overflow-hidden px-5 text-sm leading-6 text-[var(--lagecto-muted)]">
                  <span className="block pb-4">{faq.answer}</span>
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
