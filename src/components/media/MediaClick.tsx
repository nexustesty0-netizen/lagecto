"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MediaPreview } from "@/components/media/MediaPreview";
import { isSocialMediaUrl } from "@/lib/media";
import { hasProductPhoto } from "@/lib/placeholder-cover";

export function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={onClose} role="dialog" aria-label={alt}>
      <div className="max-h-full max-w-full" onClick={(event) => event.stopPropagation()}>
        <MediaPreview url={src} title={alt} className="max-h-[90vh] max-w-[90vw]" imgClassName="max-h-[90vh] max-w-[90vw] object-contain" />
      </div>
    </div>
  );
}

export function ClickablePhoto({
  url,
  alt,
  className,
  href,
}: {
  url: string;
  alt: string;
  className?: string;
  href?: string;
}) {
  const [open, setOpen] = useState(false);
  if (href) {
    return (
      <Link href={href} className="shrink-0" aria-label={alt}>
        <MediaPreview url={url} title={alt} className={className} imgClassName={className} interactive={false} />
      </Link>
    );
  }
  if (!hasProductPhoto(url) && !isSocialMediaUrl(url)) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="shrink-0" aria-label={`View ${alt}`}>
        <MediaPreview url={url} title={alt} className={className} imgClassName={className} interactive={false} />
      </button>
      {open ? <ImageLightbox src={url} alt={alt} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function CatalogMediaHotspot({
  href,
  name,
}: {
  href: string;
  image?: string | null;
  name: string;
  type?: "product" | "service";
}) {
  return <Link href={href} className="absolute inset-0 z-[1]" aria-label={name} />;
}
