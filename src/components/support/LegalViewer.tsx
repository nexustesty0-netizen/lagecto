"use client";

import { useMemo, useState } from "react";
import { formatDate } from "@/lib/format";

function stripDraftNotice(content: string) {
  return content
    .split("\n")
    .filter((line) => {
      const text = line.toLowerCase();
      return (
        !text.includes("operating statement") &&
        !text.includes("certified legal opinion") &&
        !text.includes("binding policy") &&
        !text.includes("working draft") &&
        !text.includes("not legal advice") &&
        !text.includes("before relying on it as a binding") &&
        !text.includes("have counsel review")
      );
    })
    .join("\n")
    .replace(/^\n+/, "")
    .trim();
}

export function LegalViewer({
  title,
  version,
  effectiveOn,
  publishedAt,
  content,
  history,
  slug,
  basePath,
}: {
  title: string;
  version: number;
  effectiveOn?: string | null;
  publishedAt?: string | null;
  content: string;
  history: { id: string; version: number; effective_on?: string | null; status: string }[];
  slug: string;
  basePath: string;
}) {
  const [q, setQ] = useState("");
  const body = useMemo(() => stripDraftNotice(content), [content]);
  const headings = useMemo(
    () =>
      body
        .split("\n")
        .filter((line) => /^\d+\.\s/.test(line.trim()))
        .map((line) => line.trim()),
    [body],
  );
  const filtered = q.trim()
    ? body
        .split("\n")
        .filter((line) => line.toLowerCase().includes(q.trim().toLowerCase()))
        .join("\n")
    : body;
  const blocks = filtered.split(/\n{2,}/).filter(Boolean);

  return (
    <article className="lg-legal overflow-hidden rounded-[var(--lg-radius)] border border-[var(--lagecto-border)] bg-white">
      <div className="border-b border-[var(--lagecto-border)] px-5 py-6 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">Legal</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-[var(--lagecto-muted)]">
          Version {version}
          {effectiveOn ? ` · Effective ${effectiveOn}` : ""}
          {publishedAt ? ` · Published ${formatDate(publishedAt)}` : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <button type="button" className="rounded-full border px-3 py-1" onClick={() => window.print()}>
            Print
          </button>
          <a className="rounded-full border px-3 py-1" href={`data:text/plain,${encodeURIComponent(body)}`} download={`${slug}-v${version}.txt`}>
            Download
          </a>
        </div>
        <label className="mt-6 block text-sm">
          Search this document
          <input value={q} onChange={(event) => setQ(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
        </label>
      </div>
      {headings.length ? (
        <nav className="border-b border-[var(--lagecto-border)] bg-[#FFFDF8] px-5 py-5 sm:px-8" aria-label="Table of contents">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--lagecto-muted)]">Contents</p>
          <ol className="mt-3 grid gap-1 text-sm">
            {headings.map((heading) => (
              <li key={heading}>{heading}</li>
            ))}
          </ol>
        </nav>
      ) : null}
      <div className="grid gap-5 px-5 py-8 text-base leading-7 sm:px-8">
        {blocks.map((block) => {
          const lines = block.split("\n");
          const heading = /^\d+\.\s/.test(lines[0] || "");
          if (heading) {
            return (
              <section key={block.slice(0, 48)}>
                <h2 className="text-lg font-semibold">{lines[0]}</h2>
                {lines.slice(1).join("\n").trim() ? (
                  <p className="mt-2 whitespace-pre-wrap text-[var(--lagecto-text)]">{lines.slice(1).join("\n")}</p>
                ) : null}
              </section>
            );
          }
          return (
            <p key={block.slice(0, 48)} className="whitespace-pre-wrap">
              {block}
            </p>
          );
        })}
      </div>
      {history.length > 1 ? (
        <section className="border-t border-[var(--lagecto-border)] px-5 py-6 sm:px-8">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#D4AF37]">Previous versions</h2>
          <ul className="mt-2 text-sm">
            {history.map((row) => (
              <li key={row.id}>
                <a className="text-[#0B6E4F]" href={`${basePath}/${slug}?v=${row.version}`}>
                  v{row.version} · {row.status}
                  {row.effective_on ? ` · ${row.effective_on}` : ""}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
