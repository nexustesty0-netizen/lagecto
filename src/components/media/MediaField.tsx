"use client";

import { useState } from "react";
import { IMAGE_SIZE_HINT, validateImageUrl, validateUpload, validateVideoUrl } from "@/lib/media";
import { MediaPreview } from "@/components/media/MediaPreview";

export function MediaField({
  label,
  value,
  onChange,
  purpose,
  accept,
  hint,
  allowUpload,
  quotaUrl,
}: {
  label: string;
  value?: string | null;
  onChange: (url: string | null) => void;
  purpose: "logo" | "cover" | "product" | "media" | "video" | "blog" | "ad";
  accept?: string;
  hint?: string;
  allowUpload?: boolean;
  quotaUrl?: string | null;
}) {
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const isVideo = purpose === "video";
  const urlOnly = purpose === "video" || purpose === "blog";
  const canUpload = allowUpload ?? !urlOnly;
  const fileAccept = accept || "image/*";

  async function upload(file: File) {
    setError("");
    if (!canUpload || isVideo) {
      setError("Videos must be added as a URL.");
      return;
    }
    const sizeCheck = validateUpload(file, "image");
    if (!sizeCheck.ok) {
      setError(sizeCheck.error);
      return;
    }
    setUploading(true);
    const form = new FormData();
    form.set("purpose", purpose);
    form.set("file", file);
    const currentUrl = quotaUrl || value;
    if (currentUrl) form.set("currentUrl", currentUrl);
    const res = await fetch("/api/uploads", { method: "POST", body: form });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) {
      setError(data.error || "Upload failed.");
      return;
    }
    onChange(data.url);
  }

  function applyUrl() {
    if (isVideo) {
      const result = validateVideoUrl(url);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onChange(result.source.href);
      setError("");
      setUrl("");
      return;
    }
    const result = validateImageUrl(url);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onChange(result.href);
    setError("");
    setUrl("");
  }

  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">{label}</p>
      {value ? (
        <div className="overflow-hidden rounded-2xl border border-[var(--lagecto-border)] bg-white">
          <MediaPreview
            url={value}
            title={label}
            className={isVideo ? "w-full max-h-[32rem]" : "max-h-64 w-full"}
            imgClassName="mx-auto max-h-64 w-full object-contain"
          />
          <div className="flex gap-2 border-t px-3 py-2">
            <button type="button" className="text-sm text-[#C2413B]" onClick={() => onChange(null)}>
              Remove
            </button>
          </div>
        </div>
      ) : null}
      {canUpload ? (
        <label className="rounded-xl border border-dashed px-3 py-3 text-sm">
          {uploading ? "Uploading…" : "Upload from this device"}
          <input
            type="file"
            accept={fileAccept}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
      ) : null}
      <div className="flex gap-2">
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={isVideo ? "Facebook, Instagram, YouTube, or TikTok URL" : "Image URL or Instagram / TikTok / Facebook / YouTube link"}
          className="flex-1 rounded-xl border px-3 py-2"
        />
        <button type="button" onClick={applyUrl} className="rounded-xl border px-3 py-2 text-sm">
          Use URL
        </button>
      </div>
      <p className="text-xs text-[var(--lagecto-muted)]">{[hint, isVideo ? null : IMAGE_SIZE_HINT].filter(Boolean).join(" ")}</p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
