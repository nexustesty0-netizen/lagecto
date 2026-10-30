"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FAQ_SECTION_LABELS } from "@/lib/support/constants";

export function AdminFaqForm({
  faq,
}: {
  faq?: {
    id: string;
    section: string;
    audience: string;
    question: string;
    answer: string;
    sort_order: number | null;
    featured: boolean | null;
    is_published: boolean | null;
    is_archived: boolean | null;
  };
}) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/admin/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_faq",
        id: faq?.id,
        section: form.get("section"),
        audience: form.get("audience"),
        question: form.get("question"),
        answer: form.get("answer"),
        sortOrder: form.get("sort_order"),
        featured: form.get("featured") === "on",
        published: form.get("published") === "on",
        archived: form.get("archived") === "on",
      }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Unable to save.");
    else {
      setError("");
      event.currentTarget.reset();
      router.refresh();
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="lg-card grid gap-2 p-4">
      <input name="question" required defaultValue={faq?.question} placeholder="Question" className="rounded-xl border px-3 py-2" />
      <textarea name="answer" required defaultValue={faq?.answer} placeholder="Answer" className="min-h-24 rounded-xl border px-3 py-2" />
      <div className="grid gap-2 sm:grid-cols-3">
        <select name="section" defaultValue={faq?.section || "account"} className="rounded-xl border px-3 py-2">
          {Object.keys(FAQ_SECTION_LABELS).map((section) => (
            <option key={section} value={section}>
              {FAQ_SECTION_LABELS[section]}
            </option>
          ))}
        </select>
        <select name="audience" defaultValue={faq?.audience || "all"} className="rounded-xl border px-3 py-2">
          <option value="all">All</option>
          <option value="customer">Customer</option>
          <option value="shop_owner">Shop owner</option>
        </select>
        <input name="sort_order" type="number" defaultValue={faq?.sort_order || 0} className="rounded-xl border px-3 py-2" />
      </div>
      <label className="text-sm">
        <input type="checkbox" name="featured" defaultChecked={Boolean(faq?.featured)} /> Featured
      </label>
      <label className="text-sm">
        <input type="checkbox" name="published" defaultChecked={faq?.is_published !== false} /> Published
      </label>
      <label className="text-sm">
        <input type="checkbox" name="archived" defaultChecked={Boolean(faq?.is_archived)} /> Archive
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">{faq ? "Update FAQ" : "Create FAQ"}</button>
    </form>
  );
}

export function AdminArticleForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/admin/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_article",
        slug: form.get("slug"),
        kind: form.get("kind"),
        title: form.get("title"),
        summary: form.get("summary"),
        body: form.get("body"),
        category: form.get("category"),
        audience: form.get("audience"),
        published: form.get("published") === "on",
        sortOrder: form.get("sort_order"),
      }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Unable to save.");
    else {
      event.currentTarget.reset();
      router.refresh();
    }
  }
  return (
    <form onSubmit={(event) => void save(event)} className="lg-card grid gap-2 p-4">
      <input name="title" required placeholder="Title" className="rounded-xl border px-3 py-2" />
      <input name="slug" required placeholder="slug" className="rounded-xl border px-3 py-2" />
      <input name="summary" placeholder="Summary" className="rounded-xl border px-3 py-2" />
      <textarea name="body" required placeholder="Body" className="min-h-32 rounded-xl border px-3 py-2" />
      <div className="grid gap-2 sm:grid-cols-3">
        <select name="kind" className="rounded-xl border px-3 py-2">
          <option value="article">Help article</option>
          <option value="troubleshooting">Troubleshooting</option>
        </select>
        <input name="category" defaultValue="general" className="rounded-xl border px-3 py-2" />
        <select name="audience" className="rounded-xl border px-3 py-2">
          <option value="all">All</option>
          <option value="customer">Customer</option>
          <option value="shop_owner">Shop owner</option>
        </select>
      </div>
      <input name="sort_order" type="number" defaultValue={0} className="rounded-xl border px-3 py-2" />
      <label className="text-sm">
        <input type="checkbox" name="published" defaultChecked /> Published
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Save article</button>
    </form>
  );
}

export function AdminAboutForm({ page }: { page: { slug: string; title: string; body: string; status: string } }) {
  const router = useRouter();
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await fetch("/api/admin/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_about",
        slug: page.slug,
        title: form.get("title"),
        body: form.get("body"),
        status: form.get("status"),
      }),
    });
    router.refresh();
  }
  return (
    <form onSubmit={(event) => void save(event)} className="lg-card grid gap-2 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-[#D4AF37]">{page.slug}</p>
      <input name="title" defaultValue={page.title} className="rounded-xl border px-3 py-2" />
      <textarea name="body" defaultValue={page.body} className="min-h-40 rounded-xl border px-3 py-2" />
      <select name="status" defaultValue={page.status} className="rounded-xl border px-3 py-2">
        <option value="published">Published</option>
        <option value="draft">Draft</option>
      </select>
      <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Save page</button>
    </form>
  );
}

export function AdminLegalForm({ slug, canPublish }: { slug: string; canPublish: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canPublish) return;
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/admin/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_legal_draft",
        slug,
        effectiveOn: form.get("effective_on"),
        content: form.get("content"),
      }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Unable to save.");
    else router.refresh();
  }
  return (
    <form onSubmit={(event) => void save(event)} className="lg-card grid gap-2 p-4">
      <p className="text-sm text-[var(--lagecto-muted)]">Creates a new version. Publishing archives the previous published text. Have counsel review before production use.</p>
      <input name="effective_on" type="date" className="rounded-xl border px-3 py-2" />
      <textarea name="content" required placeholder="Legal text" className="min-h-48 rounded-xl border px-3 py-2" disabled={!canPublish} />
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button disabled={!canPublish} className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white disabled:opacity-50">
        Save draft version
      </button>
    </form>
  );
}

export function PublishLegalButton({ versionId }: { versionId: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="rounded-full border px-3 py-1 text-sm"
      onClick={() =>
        void fetch("/api/admin/support", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "publish_legal", versionId }),
        }).then(() => router.refresh())
      }
    >
      Publish
    </button>
  );
}
