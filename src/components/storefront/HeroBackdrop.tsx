"use client";

import { useEffect, useState } from "react";
import { MediaPreview } from "@/components/media/MediaPreview";
import { isVideoMediaUrl } from "@/lib/media";

export function HeroBackdrop({
  url,
  objectPosition = "center",
}: {
  url?: string | null;
  objectPosition?: string;
}) {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  if (!url) return null;
  if (isVideoMediaUrl(url)) {
    return (
      <MediaPreview
        url={url}
        title=""
        playing={!reduceMotion}
        muted
        interactive={false}
        fit="cover"
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition }} />
  );
}
