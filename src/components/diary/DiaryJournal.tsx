"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatDate } from "@/lib/format";
import { DIARY_ART } from "@/lib/diary-visuals";
import { deleteDiary, insertDiary, updateDiary } from "@/components/diary/diary-actions";
import { EmptyDiary, MoodChip, MoodPicker } from "@/components/diary/diary-ui";

type Row = Record<string, unknown> & { id: string };

export function DiaryJournal({ rows, userId }: { rows: Row[]; userId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mood, setMood] = useState("good");
  const [tags, setTags] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editMood, setEditMood] = useState("good");
  const [editTags, setEditTags] = useState("");
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.title, row.body, row.tags, row.mood].some((value) => String(value || "").toLowerCase().includes(q)),
    );
  }, [rows, query]);

  const open = rows.find((row) => row.id === openId) || null;

  function openEntry(row: Row) {
    setOpenId(row.id);
    setEditTitle(String(row.title || ""));
    setEditBody(String(row.body || ""));
    setEditMood(String(row.mood || "good"));
    setEditTags(String(row.tags || ""));
  }

  async function saveOpen() {
    if (!open) return;
    const result = await updateDiary("diary_journal_entries", open.id, {
      title: editTitle,
      body: editBody,
      mood: editMood,
      tags: editTags,
    });
    if (!result.ok) setError("Unable to update this entry.");
    else {
      setOpenId(null);
      router.refresh();
    }
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!body.trim()) return;
    const result = await insertDiary("diary_journal_entries", {
      user_id: userId,
      title: title.trim() || null,
      body: body.trim(),
      mood,
      tags: tags.trim() || null,
    });
    if (!result.ok) {
      setError("Unable to save this entry.");
      return;
    }
    setTitle("");
    setBody("");
    setTags("");
    router.refresh();
  }

  async function remove(id: string) {
    await deleteDiary("diary_journal_entries", id);
    setOpenId(null);
    router.refresh();
  }

  if (open) {
    return (
      <article className="lg-card diary-rise p-5">
        <button type="button" className="text-sm text-[#0B6E4F]" onClick={() => setOpenId(null)}>
          Back to journal
        </button>
        <input
          className="mt-4 w-full rounded-2xl border px-3 py-3 text-xl font-semibold"
          value={editTitle}
          onChange={(event) => setEditTitle(event.target.value)}
          placeholder="Title"
        />
        <p className="mt-2 text-sm text-[var(--lagecto-muted)]">{formatDate(String(open.created_at || ""))}</p>
        <div className="mt-3">
          <MoodPicker value={editMood} onChange={setEditMood} />
        </div>
        <textarea
          className="mt-4 min-h-56 w-full rounded-2xl border px-3 py-3"
          value={editBody}
          onChange={(event) => setEditBody(event.target.value)}
        />
        <input
          className="mt-3 w-full rounded-2xl border px-3 py-3 text-sm"
          placeholder="Tags, comma separated"
          value={editTags}
          onChange={(event) => setEditTags(event.target.value)}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => void saveOpen()} className="rounded-full bg-[#0B6E4F] px-4 py-2 text-sm font-semibold text-white">
            Save changes
          </button>
          <button type="button" onClick={() => void remove(open.id)} className="rounded-full px-4 py-2 text-sm text-[#C2413B]">
            Delete
          </button>
        </div>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </article>
    );
  }

  return (
    <div className="grid gap-5">
      <form onSubmit={(event) => void create(event)} className="lg-card grid gap-3 p-5">
        <h2 className="font-semibold">Write a new entry</h2>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" className="rounded-2xl border px-3 py-3" />
        <MoodPicker value={mood} onChange={setMood} />
        <textarea value={body} onChange={(event) => setBody(event.target.value)} required placeholder="Today I learned…" className="min-h-32 rounded-2xl border px-3 py-3" />
        <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Tags (comma separated)" className="rounded-2xl border px-3 py-3 text-sm" />
        <button className="rounded-full bg-[#0B6E4F] px-4 py-3 text-sm font-semibold text-white">Save entry</button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search entries"
        className="rounded-full border bg-white px-4 py-3"
      />
      {!filtered.length ? (
        <EmptyDiary title="Your story starts here." body="Write your first journal entry." art={DIARY_ART.journal} />
      ) : (
        <div className="grid gap-3">
          {filtered.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => openEntry(row)}
              className="lg-card diary-rise p-5 text-left"
            >
              <p className="font-semibold">{String(row.title || String(row.body).slice(0, 48) || "Untitled")}</p>
              <p className="mt-1 line-clamp-2 text-sm text-[var(--lagecto-muted)]">{String(row.body)}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {row.mood ? <MoodChip value={String(row.mood)} /> : null}
                <span className="text-xs text-[var(--lagecto-muted)]">{formatDate(String(row.created_at || ""))}</span>
                {row.tags ? <span className="text-xs text-[#0B6E4F]">{String(row.tags)}</span> : null}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
