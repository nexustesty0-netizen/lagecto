"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MediaPreview } from "@/components/media/MediaPreview";
import { mediaFrameClass, validateImageUrl, validateVideoUrl } from "@/lib/media";

type MediaType = "none" | "image" | "video";

type Project = {
  id: string;
  title: string;
  summary: string | null;
  body: string | null;
  cover_url: string | null;
  media_type?: MediaType | null;
  media_url?: string | null;
  is_published: boolean;
};

export function ProjectManager({ shopId, projects }: { shopId: string; projects: Project[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Partial<Project> | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>("none");
  const [mediaUrl, setMediaUrl] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Project | null>(null);

  function openNew() {
    setError("");
    setMediaType("none");
    setMediaUrl("");
    setEditing({ title: "", summary: "", body: "", is_published: true });
  }

  function openEdit(project: Project) {
    const type = project.media_type || (project.cover_url || project.media_url ? "image" : "none");
    setError("");
    setMediaType(type);
    setMediaUrl(project.media_url || project.cover_url || "");
    setEditing(project);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    let url: string | null = mediaUrl.trim() || null;
    if (mediaType === "image") {
      if (!url) {
        setError("Paste an HTTPS image URL.");
        return;
      }
      const result = validateImageUrl(url);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      url = result.href;
    }
    if (mediaType === "video") {
      if (!url) {
        setError("Paste a Facebook, Instagram, YouTube, or TikTok URL.");
        return;
      }
      const result = validateVideoUrl(url);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      url = result.source.href;
    }
    if (mediaType === "none") url = null;

    const supabase = createBrowserSupabase();
    const payload = {
      shop_id: shopId,
      title: String(form.get("title") || "").trim(),
      summary: String(form.get("summary") || "").trim() || null,
      body: String(form.get("body") || "").trim() || null,
      media_type: mediaType,
      media_url: url,
      cover_url: mediaType === "image" ? url : null,
      is_published: form.get("is_published") === "on",
      updated_at: new Date().toISOString(),
    };
    if (!payload.title) {
      setError("Title is required.");
      return;
    }
    const query = editing?.id
      ? supabase.from("storefront_projects").update(payload).eq("id", editing.id).eq("shop_id", shopId)
      : supabase.from("storefront_projects").insert({ ...payload, sort_order: projects.length });
    const { error: saveError } = await query;
    if (saveError) {
      setError("Unable to save this project. Apply the storefront projects SQL if this is the first time.");
      return;
    }
    setEditing(null);
    router.refresh();
  }

  async function remove() {
    if (!pending) return;
    const supabase = createBrowserSupabase();
    await supabase.from("storefront_projects").delete().eq("id", pending.id).eq("shop_id", shopId);
    setPending(null);
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-[var(--lagecto-muted)]">
        Show completed work on your public Projects page. Use an image URL or a Facebook, Instagram, YouTube, or TikTok
        video URL. Photos from this device are not accepted.
      </p>
      <button type="button" onClick={openNew} className="w-fit rounded-full bg-[#0B6E4F] px-4 py-2 text-sm font-semibold text-white">
        + New project
      </button>
      {projects.map((project) => (
        <article key={project.id} className="lg-card flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="font-semibold">{project.title}</p>
            <p className="text-sm text-[var(--lagecto-muted)]">
              {project.is_published ? "Published" : "Hidden"} · {project.media_type || "none"}
            </p>
          </div>
          <div className="flex gap-2 text-sm">
            <button type="button" className="text-[#0B6E4F]" onClick={() => openEdit(project)}>
              Edit
            </button>
            <button type="button" className="text-[#C2413B]" onClick={() => setPending(project)}>
              Delete
            </button>
          </div>
        </article>
      ))}
      {editing ? (
        <form onSubmit={save} className="lg-card grid gap-3 p-5">
          <input name="title" required defaultValue={editing.title || ""} placeholder="Project title" className="rounded-xl border px-3 py-2" />
          <input name="summary" defaultValue={editing.summary || ""} placeholder="Short summary" className="rounded-xl border px-3 py-2" />
          <textarea name="body" defaultValue={editing.body || ""} placeholder="What you delivered" className="min-h-32 rounded-xl border px-3 py-2" />
          <label className="grid gap-1 text-sm">
            Media
            <select
              value={mediaType}
              onChange={(event) => {
                setMediaType(event.target.value as MediaType);
                setMediaUrl("");
              }}
              className="rounded-xl border px-3 py-2"
            >
              <option value="none">No media</option>
              <option value="image">Image URL</option>
              <option value="video">Video URL</option>
            </select>
          </label>
          {mediaType !== "none" ? (
            <label className="grid gap-1 text-sm">
              {mediaType === "image" ? "Image URL" : "Video URL"}
              <input
                value={mediaUrl}
                onChange={(event) => setMediaUrl(event.target.value)}
                placeholder={mediaType === "image" ? "https://example.com/image.jpg" : "Facebook, Instagram, YouTube, or TikTok URL"}
                className="rounded-xl border px-3 py-2"
              />
            </label>
          ) : null}
          {mediaType !== "none" && mediaUrl ? (
            <MediaPreview url={mediaUrl} title={editing.title || "Preview"} className={mediaFrameClass(mediaUrl)} />
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_published" defaultChecked={editing.is_published !== false} />
            Show on the storefront
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex gap-2">
            <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Save project</button>
            <button type="button" className="rounded-xl border px-4 py-2" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      <ConfirmDialog
        open={Boolean(pending)}
        title="Delete this project?"
        body="Customers will no longer see it on your storefront."
        onCancel={() => setPending(null)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
