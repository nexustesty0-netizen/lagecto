"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { embedPlaybackUrl, parseMediaEmbed, type MediaProvider, type ParsedMedia } from "@/lib/media";
import { isPlaceholderCover } from "@/lib/placeholder-cover";
import { QuietCover } from "@/components/media/QuietCover";
import { FacebookEmbed } from "@/components/media/FacebookEmbed";
import { socialEmbedFrameClass } from "@/components/media/embed-frame";

const IFRAME_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share";

function hasBoxSize(className?: string) {
  return Boolean(className && /\b(aspect-|min-h-|h-\d|h-full|absolute|inset-)/.test(className));
}

function defaultBox(media: ParsedMedia) {
  if (media.aspect === "post" || media.media === "image") return "aspect-[4/5] w-full";
  return "aspect-video w-full";
}

function wrapClass(media: ParsedMedia, className?: string) {
  if (hasBoxSize(className)) return className || "";
  return `${defaultBox(media)} ${className || ""}`.trim();
}

function shellClass(box: string, bg: string, className?: string) {
  const position = className?.includes("absolute") ? "" : "relative";
  return `${position} @container overflow-hidden ${bg} ${box}`.trim();
}

function iframeReferrer(provider: MediaProvider) {
  if (provider === "facebook" || provider === "instagram" || provider === "tiktok") {
    return "no-referrer-when-downgrade" as const;
  }
  return "origin-when-cross-origin" as const;
}

function MediaUnavailable({ className }: { className?: string }) {
  return (
    <div className={shellClass(className || "min-h-40 w-full", "bg-[#111]", className)}>
      <p className="absolute inset-0 grid place-items-center px-4 text-center text-sm text-white/80">Media unavailable</p>
    </div>
  );
}

function SafeImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span className="grid h-full w-full place-items-center px-3 text-center text-sm text-[#6B7280]">Media unavailable</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />
  );
}

function PlayHint() {
  return (
    <span className="grid h-16 w-16 place-items-center rounded-full bg-black/55 text-white shadow-lg">
      <Play size={28} fill="currentColor" className="ml-0.5" />
    </span>
  );
}

function MutedAutoplayVideo({ src, cover, playable }: { src: string; cover: boolean; playable?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = true;
    el.defaultMuted = true;
    el.volume = 0;
    el.setAttribute("webkit-playsinline", "true");
    const play = () => {
      el.muted = true;
      el.volume = 0;
      void el.play().then(() => setStarted(true)).catch(() => {});
    };
    play();
    el.addEventListener("canplay", play);
    el.addEventListener("loadeddata", play);
    el.addEventListener("loadedmetadata", play);
    const onVisible = () => {
      if (document.visibilityState === "visible") play();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      el.removeEventListener("canplay", play);
      el.removeEventListener("loadeddata", play);
      el.removeEventListener("loadedmetadata", play);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [src]);
  return (
    <>
      <video
        ref={ref}
        src={src}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        controls={false}
        className={`absolute inset-0 h-full w-full ${cover ? "object-cover" : "object-contain"}`}
      />
      {playable && !started ? (
        <button
          type="button"
          className="absolute inset-0 z-[3] grid place-items-center"
          aria-label="Play video"
          onClick={() => {
            const el = ref.current;
            if (!el) return;
            void el.play().then(() => setStarted(true)).catch(() => {});
          }}
        >
          <PlayHint />
        </button>
      ) : null}
    </>
  );
}

function kickEmbedPlayback(win: Window | null, provider: MediaProvider) {
  if (!win) return;
  if (provider === "youtube") {
    win.postMessage(JSON.stringify({ event: "command", func: "mute", args: [] }), "*");
    win.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*");
    return;
  }
  if (provider === "vimeo") {
    win.postMessage(JSON.stringify({ method: "setVolume", value: 0 }), "*");
    win.postMessage(JSON.stringify({ method: "play" }), "*");
    return;
  }
  if (provider === "tiktok") {
    win.postMessage({ "x-tiktok-player": true, type: "mute" }, "*");
    win.postMessage({ "x-tiktok-player": true, type: "play" }, "*");
  }
}

function heroIframeSrc(src: string, provider: MediaProvider) {
  if (provider !== "youtube" || typeof window === "undefined") return src;
  try {
    const url = new URL(src);
    url.searchParams.set("origin", window.location.origin);
    url.searchParams.set("enablejsapi", "1");
    url.searchParams.set("mute", "1");
    return url.toString();
  } catch {
    return src;
  }
}

function photoClass(fit: "contain" | "cover", imgClassName: string) {
  if (imgClassName !== "h-full w-full object-cover") return imgClassName;
  return `absolute inset-0 h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"}`;
}

function EmbedFrame({
  src,
  title,
  provider,
  playing,
  cover,
  kind = "video",
  aspect = "landscape",
}: {
  src: string;
  title: string;
  provider: MediaProvider;
  playing: boolean;
  cover: boolean;
  kind?: "photo" | "video";
  aspect?: ParsedMedia["aspect"];
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const framed = heroIframeSrc(src, provider);
  const playable = !cover && kind === "video";
  const tapIframe = playable && (provider === "instagram" || provider === "facebook");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!playing || started) return;
    const iframe = ref.current;
    if (!iframe) return;
    const kick = () => kickEmbedPlayback(iframe.contentWindow, provider);
    kick();
    const timers = [400, 1200, 2500].map((ms) => window.setTimeout(kick, ms));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [framed, playing, provider, started]);

  function play() {
    kickEmbedPlayback(ref.current?.contentWindow || null, provider);
    setStarted(true);
  }

  return (
    <>
      <iframe
        ref={ref}
        src={framed}
        title={title}
        className={socialEmbedFrameClass(provider, cover, kind, aspect, !tapIframe)}
        referrerPolicy={iframeReferrer(provider)}
        allow={IFRAME_ALLOW}
        loading={playing || playable ? "eager" : "lazy"}
        tabIndex={playable ? 0 : -1}
        onLoad={() => {
          if (playing) kickEmbedPlayback(ref.current?.contentWindow || null, provider);
        }}
      />
      {playable && !started && !tapIframe ? (
        <button type="button" className="absolute inset-0 z-[3] grid place-items-center" aria-label="Play video" onClick={play}>
          <PlayHint />
        </button>
      ) : playable ? null : (
        <span className="absolute inset-0 z-[3]" aria-hidden />
      )}
    </>
  );
}

export function MediaPreview({
  url,
  title = "Media",
  className,
  imgClassName = "h-full w-full object-cover",
  interactive = true,
  playing,
  muted,
  fit = "contain",
}: {
  url: string;
  title?: string;
  className?: string;
  imgClassName?: string;
  interactive?: boolean;
  playing?: boolean;
  muted?: boolean;
  fit?: "contain" | "cover";
}) {
  if (isPlaceholderCover(url)) {
    return (
      <div className={shellClass(className || "relative min-h-full", "bg-transparent", className)}>
        <QuietCover className="absolute inset-0 h-full w-full" />
      </div>
    );
  }

  const media = parseMediaEmbed(url);
  const inPlay = playing ?? media?.media === "video";
  const silent = muted ?? Boolean(inPlay);

  if (!media) {
    const box = hasBoxSize(className) ? className || "" : "aspect-[4/5] w-full";
    return (
      <div className={shellClass(box, "bg-[#111]/5", className)}>
        <SafeImage src={url} alt={title} className={photoClass("cover", imgClassName)} />
      </div>
    );
  }

  const box = wrapClass(media, className);

  if (media.provider === "file" && media.media === "image") {
    return (
      <div className={shellClass(box, "bg-[#111]/5", className)}>
        <SafeImage src={media.href} alt={title} className={photoClass("cover", imgClassName)} />
      </div>
    );
  }

  if (media.provider === "facebook") {
    return (
      <div className={shellClass(box, "bg-black", className)}>
        <FacebookEmbed
          url={media.href}
          title={title}
          playing={Boolean(inPlay)}
          muted={silent}
          interactive={false}
          cover={fit === "cover"}
        />
      </div>
    );
  }

  if (media.provider === "file" && media.media === "video") {
    return (
      <div className={shellClass(box, "bg-black", className)}>
        {inPlay && silent ? (
          <MutedAutoplayVideo src={media.href} cover playable={interactive} />
        ) : (
          <video
            src={media.href}
            controls={interactive}
            autoPlay={inPlay}
            muted={silent}
            loop={inPlay}
            playsInline
            preload={inPlay ? "auto" : "metadata"}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {interactive ? null : <span className="absolute inset-0 z-[3]" aria-hidden />}
      </div>
    );
  }

  if (!media.embed) return <MediaUnavailable className={className} />;

  return (
    <div className={shellClass(box, "bg-black", className)}>
      <EmbedFrame
        src={embedPlaybackUrl(media.embed, media.provider, Boolean(inPlay), silent, true)}
        title={title}
        provider={media.provider}
        playing={Boolean(inPlay)}
        cover={fit === "cover"}
        kind={media.provider === "instagram" && media.aspect === "post" ? "photo" : "video"}
        aspect={media.aspect}
      />
    </div>
  );
}
