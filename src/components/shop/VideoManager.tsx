"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MediaField } from "@/components/media/MediaField";
import { MediaPreview } from "@/components/media/MediaPreview";
import { validateVideoUrl } from "@/lib/media";

type Video = {
  id: string;
  title: string;
  description: string | null;
  url: string;
  source_type: "upload" | "url";
  is_published: boolean;
};

export function VideoManager({ shopId, videos }: { shopId: string; videos: Video[] }) {
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Video | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!url) {
      setError("Paste a Facebook, Instagram, YouTube, or TikTok URL.");
      return;
    }
    const parsed = validateVideoUrl(url);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    const sourceType = parsed.source.kind !== "file" ? "url" : url.includes("/storage/") ? "upload" : "url";
    const supabase = createBrowserSupabase();
    const form = new FormData(event.currentTarget);
    const { error: insertError } = await supabase.from("storefront_videos").insert({
      shop_id: shopId,
      title: String(form.get("title") || "").trim(),
      description: String(form.get("description") || ""),
      url,
      source_type: sourceType,
      is_published: true,
    });
    if (insertError) setError("Unable to save this video.");
    else {
      event.currentTarget.reset();
      setUrl(null);
      router.refresh();
    }
  }

  async function remove() {
    if (!pending) return;
    const supabase = createBrowserSupabase();
    await supabase.from("storefront_videos").delete().eq("id", pending.id).eq("shop_id", shopId);
    setPending(null);
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <form onSubmit={save} className="lg-card grid gap-3 p-5">
        <input name="title" required placeholder="Video title" className="rounded-xl border px-3 py-2" />
        <textarea name="description" placeholder="What should customers see?" className="min-h-20 rounded-xl border px-3 py-2" />
        <MediaField
          label="Video"
          purpose="video"
          value={url}
          onChange={setUrl}
          hint="Paste a Facebook, Instagram, YouTube, or TikTok URL. Videos cannot be uploaded from this device."
        />
        <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Add video</button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>
      {videos.map((video) => (
        <article key={video.id} className="lg-card overflow-hidden">
          <MediaPreview url={video.url} title={video.title} />
          <div className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="font-semibold">{video.title}</p>
              <p className="truncate text-sm text-[var(--lagecto-muted)]">{video.url}</p>
            </div>
            <button type="button" className="shrink-0 text-sm text-[#C2413B]" onClick={() => setPending(video)}>
              Delete
            </button>
          </div>
        </article>
      ))}
      <ConfirmDialog open={Boolean(pending)} title="Remove this video?" body="It will disappear from the storefront." onCancel={() => setPending(null)} onConfirm={() => void remove()} />
    </div>
  );
}
