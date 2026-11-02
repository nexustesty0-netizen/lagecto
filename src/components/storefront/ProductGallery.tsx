"use client";

import { useState } from "react";
import { MediaPreview } from "@/components/media/MediaPreview";
import { ImageLightbox } from "@/components/media/MediaClick";
import { parseMediaEmbed } from "@/lib/media";
import { isPlaceholderCover } from "@/lib/placeholder-cover";

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const current = images[index] || images[0];
  if (!current) return null;
  const parsed = parseMediaEmbed(current);
  const canZoom = !isPlaceholderCover(current) && parsed?.provider === "file" && parsed.media === "image";

  return (
    <div>
      <div className="relative aspect-square w-full overflow-hidden rounded-[var(--lg-radius)] bg-black/5">
        <MediaPreview url={current} title={name} playing className="absolute inset-0 h-full w-full" imgClassName="h-full w-full object-contain" />
        {canZoom ? (
          <button type="button" className="absolute inset-0 z-[1]" onClick={() => setZoomed(true)} aria-label={`View ${name}`} />
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
              <MediaPreview url={src} title="" className="h-full w-full" interactive={false} fit="cover" />
            </button>
          ))}
        </div>
      ) : null}
      {zoomed ? <ImageLightbox src={current} alt={name} onClose={() => setZoomed(false)} /> : null}
    </div>
  );
}
