"use client";

import { useMemo, useState } from "react";
import { formatDate } from "@/lib/format";

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
  const headings = useMemo(
    () =>
      content
        .split("\n")
        .filter((line) => /^\d+\.\s/.test(line.trim()))
        .map((line) => line.trim()),
    [content],
  );
  const filtered = q.trim()
    ? content
        .split("\n")
        .filter((line) => line.toLowerCase().includes(q.trim().toLowerCase()))
        .join("\n")
    : content;

  return (
    <article className="lg-legal">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">Legal</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-[var(--lagecto-muted)]">
        Version {version}
        {effectiveOn ? ` · Effective ${effectiveOn}` : ""}
        {publishedAt ? ` · Published ${formatDate(publishedAt)}` : ""}
      </p>
      <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Working draft for LaGecto / Gecto Tech review. This is not legal advice and should be approved before you rely on it as a binding policy.
      </p>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <button type="button" className="rounded-full border px-3 py-1" onClick={() => window.print()}>
          Print
        </button>
        <a className="rounded-full border px-3 py-1" href={`data:text/plain,${encodeURIComponent(content)}`} download={`${slug}-v${version}.txt`}>
          Download
        </a>
      </div>
      <label className="mt-6 block text-sm">
        Search this document
        <input value={q} onChange={(e) => setQ(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
      </label>
      {headings.length ? (
        <nav className="mt-6 lg-card p-4" aria-label="Table of contents">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--lagecto-muted)]">Contents</p>
          <ol className="mt-2 grid gap-1 text-sm">
            {headings.map((heading) => (
              <li key={heading}>{heading}</li>
            ))}
          </ol>
        </nav>
      ) : null}
      <div className="mt-8 whitespace-pre-wrap text-base leading-7">{filtered}</div>
      {history.length > 1 ? (
        <section className="mt-10">
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
