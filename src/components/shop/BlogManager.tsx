"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatDate } from "@/lib/format";
import { validateImageUrl, validateVideoUrl } from "@/lib/media";
import { MediaPreview } from "@/components/media/MediaPreview";

type MediaType = "none" | "image" | "video";

type Post = {
  id: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  cover_image: string | null;
  media_type?: MediaType | null;
  media_url?: string | null;
  status: "draft" | "published";
  published_at: string | null;
  created_at?: string;
  updated_at?: string;
};

export function BlogManager({ shopId, posts }: { shopId: string; posts: Post[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Partial<Post> | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>("none");
  const [mediaUrl, setMediaUrl] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Post | null>(null);

  function openNew() {
    setError("");
    setMediaType("none");
    setMediaUrl("");
    setEditing({ title: "", excerpt: "", body: "", status: "draft" });
  }

  function openEdit(post: Post) {
    const type = post.media_type || (post.cover_image ? "image" : "none");
    setError("");
    setMediaType(type);
    setMediaUrl(post.media_url || post.cover_image || "");
    setEditing(post);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const status = String(form.get("status") || "draft") as "draft" | "published";
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
        setError("Paste a YouTube, Instagram, TikTok, Facebook, or HTTPS video URL.");
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
      excerpt: String(form.get("excerpt") || ""),
      body: String(form.get("body") || ""),
      media_type: mediaType,
      media_url: url,
      cover_image: mediaType === "image" ? url : null,
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    if (!payload.title) return;
    const query = editing?.id
      ? supabase.from("storefront_blog_posts").update(payload).eq("id", editing.id).eq("shop_id", shopId)
      : supabase.from("storefront_blog_posts").insert(payload);
    const { error: saveError } = await query;
    if (saveError) {
      setError(saveError.message.includes("Kristen") ? "Blogs require Kristen or Sandra." : "Unable to save this post.");
      return;
    }
    setEditing(null);
    router.refresh();
  }

  async function remove() {
    if (!pending) return;
    const supabase = createBrowserSupabase();
    await supabase.from("storefront_blog_posts").delete().eq("id", pending.id).eq("shop_id", shopId);
    setPending(null);
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <button type="button" onClick={openNew} className="w-fit rounded-full bg-[#0B6E4F] px-4 py-2 text-sm font-semibold text-white">
        + New post
      </button>
      {posts.map((post) => (
        <article key={post.id} className="lg-card flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="font-semibold">{post.title}</p>
            <p className="text-sm text-[var(--lagecto-muted)]">
              {post.status} {post.published_at ? `· ${formatDate(post.published_at)}` : ""} · {post.media_type || "none"}
            </p>
          </div>
          <div className="flex gap-2 text-sm">
            <button type="button" className="text-[#0B6E4F]" onClick={() => openEdit(post)}>
              Edit
            </button>
            <button type="button" className="text-[#C2413B]" onClick={() => setPending(post)}>
              Delete
            </button>
          </div>
        </article>
      ))}
      {editing ? (
        <form onSubmit={save} className="lg-card grid gap-3 p-5">
          <input name="title" required defaultValue={editing.title || ""} placeholder="Title" className="rounded-xl border px-3 py-2" />
          <input name="excerpt" defaultValue={editing.excerpt || ""} placeholder="Short excerpt" className="rounded-xl border px-3 py-2" />
          <textarea name="body" defaultValue={editing.body || ""} placeholder="Write the article" className="min-h-40 rounded-xl border px-3 py-2" />
          <label className="grid gap-1 text-sm">
            Media
            <select
              value={mediaType}
              onChange={(event) => setMediaType(event.target.value as MediaType)}
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
                placeholder={mediaType === "image" ? "https://example.com/image.jpg" : "https://youtube.com/watch?v=…"}
                className="rounded-xl border px-3 py-2"
              />
            </label>
          ) : null}
          {mediaType !== "none" && mediaUrl ? <MediaPreview url={mediaUrl} title={editing.title || "Preview"} /> : null}
          <select name="status" defaultValue={editing.status || "draft"} className="rounded-xl border px-3 py-2">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex gap-2">
            <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Save post</button>
            <button type="button" className="rounded-xl border px-4 py-2" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      <ConfirmDialog open={Boolean(pending)} title="Delete this post?" body="Customers will no longer see this article." onCancel={() => setPending(null)} onConfirm={() => void remove()} />
    </div>
  );
}
