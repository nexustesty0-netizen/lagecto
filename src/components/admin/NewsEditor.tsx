"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IMAGE_SIZE_HINT, parsePublicHttpsUrl, validateUpload } from "@/lib/media";
import { LinkedNewsBody } from "@/components/news/LinkedNewsBody";

type Article = {
  id: string;
  title: string;
  excerpt: string | null;
  body: string;
  audience: string;
  category: string | null;
  status: string;
  cover_image_url?: string | null;
  video_url?: string | null;
  featured?: boolean | null;
  scheduled_at?: string | null;
  slug?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  tags?: string[] | null;
  author_name?: string | null;
};

export function NewsEditor({ article }: { article?: Article }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const [cover, setCover] = useState(article?.cover_image_url || "");
  const [title, setTitle] = useState(article?.title || "");
  const [excerpt, setExcerpt] = useState(article?.excerpt || "");
  const [body, setBody] = useState(article?.body || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function uploadCover(file: File) {
    const sizeCheck = validateUpload(file, "image");
    if (!sizeCheck.ok) {
      setError(sizeCheck.error);
      return;
    }
    const form = new FormData();
    form.set("purpose", "news");
    form.set("file", file);
    const res = await fetch("/api/uploads", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Unable to upload cover image.");
    else setCover(data.url);
  }

  async function save(status: string, scheduledAt?: string | null) {
    setError("");
    const payload = {
      id: article?.id,
      title,
      excerpt,
      body,
      audience: (document.querySelector("[name=audience]") as HTMLSelectElement)?.value || "all",
      category: (document.querySelector("[name=category]") as HTMLInputElement)?.value || "platform",
      status,
      coverImageUrl: cover,
      videoUrl: (document.querySelector("[name=video]") as HTMLInputElement)?.value || "",
      featured: (document.querySelector("[name=featured]") as HTMLInputElement)?.checked || false,
      scheduledAt: scheduledAt || null,
      slug: (document.querySelector("[name=slug]") as HTMLInputElement)?.value || "",
      seoTitle: (document.querySelector("[name=seoTitle]") as HTMLInputElement)?.value || "",
      seoDescription: (document.querySelector("[name=seoDescription]") as HTMLInputElement)?.value || "",
      tags: (document.querySelector("[name=tags]") as HTMLInputElement)?.value || "",
      authorName: (document.querySelector("[name=authorName]") as HTMLInputElement)?.value || "",
    };
    const res = await fetch("/api/admin/news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Unable to save this article.");
    else router.push("/admin/news");
  }

  async function remove() {
    if (!article?.id) return;
    const res = await fetch("/api/admin/news", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: article.id }),
    });
    if (res.ok) router.push("/admin/news");
    else setError("Unable to delete this article.");
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const status = String(form.get("status") || "draft");
    const scheduled = String(form.get("scheduledAt") || "");
    const video = String(form.get("video") || "");
    if (video) {
      const parsed = parsePublicHttpsUrl(video);
      if (!parsed.ok) {
        setError(parsed.error);
        return;
      }
    }
    void save(status, status === "scheduled" ? scheduled : null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl bg-white p-4">
        <input name="title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Headline" className="rounded-xl border px-3 py-2 text-lg" />
        <input name="slug" defaultValue={article?.slug || ""} placeholder="slug-for-url" className="rounded-xl border px-3 py-2" />
        <input name="excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="Standfirst / excerpt" className="rounded-xl border px-3 py-2" />
        <textarea
          name="body"
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Article body. Paste full https:// links and they will be clickable."
          className="min-h-56 rounded-xl border px-3 py-2"
        />
        <label className="text-sm">
          Cover image ({IMAGE_SIZE_HINT})
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="mt-1 block w-full text-sm"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadCover(file);
            }}
          />
        </label>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="h-40 w-full rounded-2xl object-cover" />
        ) : null}
        <input name="video" defaultValue={article?.video_url || ""} placeholder="Video URL (optional, HTTPS)" className="rounded-xl border px-3 py-2" />
        <div className="grid gap-3 sm:grid-cols-2">
          <select name="audience" defaultValue={article?.audience || "all"} className="rounded-xl border px-3 py-2">
            <option value="all">All</option>
            <option value="customers">Customers</option>
            <option value="shop_owners">Shop owners</option>
            <option value="guests">Guests</option>
          </select>
          <input name="category" defaultValue={article?.category || "platform"} className="rounded-xl border px-3 py-2" />
          <select name="status" defaultValue={article?.status || "draft"} className="rounded-xl border px-3 py-2">
            <option value="draft">Draft</option>
            <option value="published">Publish now</option>
            <option value="scheduled">Schedule</option>
            <option value="unpublished">Unpublished</option>
            <option value="archived">Archived</option>
          </select>
          <input name="scheduledAt" type="datetime-local" defaultValue={article?.scheduled_at ? article.scheduled_at.slice(0, 16) : ""} className="rounded-xl border px-3 py-2" />
        </div>
        <input name="authorName" defaultValue={article?.author_name || "LaGecto Editorial"} placeholder="Author" className="rounded-xl border px-3 py-2" />
        <input name="seoTitle" defaultValue={article?.seo_title || ""} placeholder="SEO title" className="rounded-xl border px-3 py-2" />
        <input name="seoDescription" defaultValue={article?.seo_description || ""} placeholder="SEO description" className="rounded-xl border px-3 py-2" />
        <input name="tags" defaultValue={(article?.tags || []).join(", ")} placeholder="Tags (comma separated)" className="rounded-xl border px-3 py-2" />
        <label className="flex items-center gap-2 text-sm">
          <input name="featured" type="checkbox" defaultChecked={Boolean(article?.featured)} /> Featured story
        </label>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Save</button>
          <button type="button" className="rounded-xl border px-4 py-2" onClick={() => setPreview((v) => !v)}>
            {preview ? "Hide preview" : "Preview"}
          </button>
          {article?.id ? (
            <button type="button" className="rounded-xl border border-red-200 px-4 py-2 text-red-700" onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          ) : null}
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>
      {preview ? (
        <article className="rounded-2xl bg-white p-5">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="mb-4 h-48 w-full rounded-2xl object-cover" />
          ) : null}
          <p className="text-xs uppercase tracking-[0.2em] text-[#D4AF37]">Preview</p>
          <h2 className="mt-2 text-2xl font-semibold">{title || "Headline"}</h2>
          {excerpt ? <LinkedNewsBody text={excerpt} className="mt-2 text-[#6B7280]" /> : null}
          <LinkedNewsBody text={body} className="mt-4 whitespace-pre-wrap leading-7" />
        </article>
      ) : (
        <div className="rounded-2xl border border-dashed p-5 text-sm text-[#6B7280]">Preview the story before publishing. Drafts stay private until published.</div>
      )}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this article?"
        body="This removes the article from News. Prefer archive/unpublish if it was already public."
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
