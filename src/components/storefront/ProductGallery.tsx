"use client";

import { useState } from "react";
import { MediaPreview } from "@/components/media/MediaPreview";
import { isSocialMediaUrl, parseMediaEmbed } from "@/lib/media";

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const current = images[index] || images[0];
  if (!current) return null;
  const parsed = parseMediaEmbed(current);
  const canZoom = !isSocialMediaUrl(current) && parsed?.media === "image";

  return (
    <div>
      <div className="relative aspect-square w-full overflow-hidden rounded-[28px] bg-black/5">
        <MediaPreview url={current} title={name} className="absolute inset-0 h-full w-full" imgClassName="h-full w-full object-contain" />
        {canZoom ? (
          <button type="button" className="absolute inset-0 z-[1]" onClick={() => setZoomed(true)} aria-label={`Enlarge ${name}`} />
        ) : null}
      </div>
      {images.length > 1 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => setIndex(i)}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-2xl ring-2 ${i === index ? "ring-[var(--sf-primary)]" : "ring-transparent"}`}
            >
              <MediaPreview url={src} title="" className="h-full w-full" interactive={false} />
            </button>
          ))}
        </div>
      ) : null}
      {zoomed ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => setZoomed(false)}>
          <MediaPreview url={current} title={name} className="max-h-full max-w-full" imgClassName="max-h-full max-w-full object-contain" />
        </div>
      ) : null}
    </div>
  );
}
