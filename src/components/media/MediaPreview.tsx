import { parseMediaEmbed, type ParsedMedia } from "@/lib/media";

const IFRAME_SANDBOX = "allow-scripts allow-same-origin allow-presentation allow-fullscreen";

function hasBoxSize(className?: string) {
  return Boolean(className && /\b(aspect-|min-h-|h-\d|h-full|absolute|inset-)/.test(className));
}

function defaultBox(media: ParsedMedia) {
  if (media.provider === "tiktok" || (media.provider === "instagram" && media.embed?.includes("/reel/"))) {
    return "mx-auto aspect-[9/16] w-full max-h-[720px]";
  }
  if (media.provider === "instagram") return "aspect-[4/5] w-full";
  if (media.aspect === "post") return "min-h-[420px] w-full";
  if (media.media === "image" && media.provider === "file") return "w-full";
  return "aspect-video w-full";
}

function wrapClass(media: ParsedMedia, className?: string) {
  if (hasBoxSize(className)) return className || "";
  return `${defaultBox(media)} ${className || ""}`.trim();
}

function shellClass(box: string, bg: string, className?: string) {
  const position = className?.includes("absolute") ? "" : "relative";
  return `${position} overflow-hidden ${bg} ${box}`.trim();
}

function EmbedFrame({
  src,
  title,
  interactive,
}: {
  src: string;
  title: string;
  interactive: boolean;
}) {
  return (
    <>
      <iframe
        src={src}
        title={title}
        className="absolute inset-0 h-full w-full border-0"
        sandbox={IFRAME_SANDBOX}
        referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        loading="lazy"
        tabIndex={interactive ? 0 : -1}
      />
      {interactive ? null : <span className="absolute inset-0 z-[1]" aria-hidden />}
    </>
  );
}

export function MediaPreview({
  url,
  title = "Media",
  className,
  imgClassName = "h-full w-full object-cover",
  interactive = true,
}: {
  url: string;
  title?: string;
  className?: string;
  imgClassName?: string;
  interactive?: boolean;
}) {
  const media = parseMediaEmbed(url);
  if (!media) {
    return (
      <div className={shellClass(className || "", "bg-[#111]/5", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={title} className={imgClassName} />
      </div>
    );
  }

  const box = wrapClass(media, className);

  if (media.provider === "file" && media.media === "image") {
    return (
      <div className={shellClass(box, "bg-[#111]/5", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={media.href} alt={title} className={imgClassName} />
      </div>
    );
  }

  if (media.provider === "file" && media.media === "video") {
    return (
      <div className={shellClass(box, "bg-black", className)}>
        <video
          src={media.href}
          controls={interactive}
          preload="metadata"
          playsInline
          className="absolute inset-0 h-full w-full object-contain"
        />
        {interactive ? null : <span className="absolute inset-0 z-[1]" aria-hidden />}
      </div>
    );
  }

  if (!media.embed) return null;

  return (
    <div className={shellClass(box, "bg-black", className)}>
      <EmbedFrame src={media.embed} title={title} interactive={interactive} />
    </div>
  );
}
