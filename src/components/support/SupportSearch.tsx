"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Hit = { id: string; question?: string; title?: string; excerpt?: string; summary?: string; slug?: string; kind?: string; section?: string };

export function SupportSearch({ basePath }: { basePath: string }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ faqs: Hit[]; articles: Hit[] } | null>(null);
  const [busy, setBusy] = useState(false);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    const query = q.trim();
    if (query.length < 2) {
      setHits({ faqs: [], articles: [] });
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/support/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setHits({ faqs: data.faqs || [], articles: data.articles || [] });
    setBusy(false);
  }

  const empty = hits && !hits.faqs.length && !hits.articles.length;
  const suggestion = useMemo(() => {
    if (!empty || q.trim().length < 2) return "";
    return q.trim().slice(0, 24);
  }, [empty, q]);

  return (
    <div className="lg-support-search">
      <form onSubmit={(event) => void search(event)} className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="support-search">
          Search help, FAQs and guides
        </label>
        <input
          id="support-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search help, FAQs and guides..."
          className="min-w-0 flex-1 rounded-full border border-white/20 bg-white/95 px-5 py-3 text-[#12241c] outline-none ring-[#D4AF37] focus:ring-2"
        />
        <button className="rounded-full bg-[#D4AF37] px-6 py-3 text-sm font-semibold text-[#12241c]" disabled={busy}>
          {busy ? "Searching…" : "Search"}
        </button>
      </form>
      {hits ? (
        <div className="mt-4 rounded-2xl bg-white/95 p-4 text-[#12241c]">
          {empty ? (
            <div>
              <p className="font-semibold">We couldn&apos;t find an answer.</p>
              {suggestion ? <p className="mt-1 text-sm text-[var(--lagecto-muted)]">Did you mean something about “{suggestion}”? Try fewer words.</p> : null}
              <Link href={`${basePath}/contact`} className="mt-3 inline-block text-sm font-semibold text-[#0B6E4F]">
                Still need help? Contact Support
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">FAQs</p>
                <ul className="mt-2 grid gap-2">
                  {hits.faqs.map((row) => (
                    <li key={row.id}>
                      <Link href={`${basePath}/faqs#${row.id}`} className="font-medium text-[#0B6E4F]">
                        {row.question}
                      </Link>
                      {row.excerpt ? <p className="text-sm text-[var(--lagecto-muted)]">{row.excerpt}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">Guides</p>
                <ul className="mt-2 grid gap-2">
                  {hits.articles.map((row) => (
                    <li key={row.id}>
                      <Link href={`${basePath}/articles/${row.slug}`} className="font-medium text-[#0B6E4F]">
                        {row.title}
                      </Link>
                      {row.summary ? <p className="text-sm text-[var(--lagecto-muted)]">{row.summary}</p> : null}
                    </li>
                  ))}
                </ul>
                <Link href={`${basePath}/contact`} className="mt-3 inline-block text-sm font-semibold text-[#0B6E4F]">
                  Related: Contact Support
                </Link>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
