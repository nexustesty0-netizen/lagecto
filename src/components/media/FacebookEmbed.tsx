"use client";

import { useEffect, useRef, useState } from "react";
import { embedPlaybackUrl, facebookPermalink, facebookPluginSrc, isCanonicalFacebookVideoUrl } from "@/lib/media";
import { socialEmbedFrameClass } from "@/components/media/embed-frame";
import type { FacebookPlayerPlan } from "@/lib/meta-oembed";

type FbSdk = {
  init: (opts: { xfbml: boolean; version: string }) => void;
  XFBML: { parse: (el?: Element | null) => void };
};

declare global {
  interface Window {
    FB?: FbSdk;
    fbAsyncInit?: () => void;
  }
}

let sdkPromise: Promise<FbSdk | null> | null = null;

function loadFacebookSdk() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.FB) return Promise.resolve(window.FB);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve) => {
    window.fbAsyncInit = () => {
      window.FB?.init({ xfbml: true, version: "v21.0" });
      resolve(window.FB || null);
    };
    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.onerror = () => resolve(null);
    document.body.appendChild(script);
  });
  return sdkPromise;
}

function fallbackPlan(url: string): FacebookPlayerPlan {
  const href = facebookPermalink(url);
  if (isCanonicalFacebookVideoUrl(href)) {
    return { mode: "iframe", embed: facebookPluginSrc(href), href };
  }
  return { mode: "sdk", href };
}

export function FacebookEmbed({
  url,
  title,
  playing,
  muted = playing,
  cover,
}: {
  url: string;
  title: string;
  playing: boolean;
  muted?: boolean;
  interactive?: boolean;
  cover: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [plan, setPlan] = useState<FacebookPlayerPlan | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/media/oembed?url=${encodeURIComponent(url)}`)
      .then((response) => (response.ok ? response.json() : fallbackPlan(url)))
      .then((data) => {
        if (!cancelled) setPlan(data as FacebookPlayerPlan);
      })
      .catch(() => {
        if (!cancelled) setPlan(fallbackPlan(url));
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    if (plan?.mode !== "sdk") return;
    let cancelled = false;
    loadFacebookSdk().then((fb) => {
      if (cancelled || !fb) return;
      fb.XFBML.parse(rootRef.current);
    });
    return () => {
      cancelled = true;
    };
  }, [plan]);

  if (!plan) return <span className="absolute inset-0 bg-black" aria-hidden />;

  if (plan.mode === "link") {
    return (
      <p className="absolute inset-0 grid place-items-center bg-black px-4 text-center text-sm font-semibold text-white/80">
        Media unavailable
      </p>
    );
  }

  if (plan.mode === "sdk") {
    return (
      <div ref={rootRef} className="absolute inset-0 overflow-hidden bg-black">
        <div
          className={
            cover
              ? "absolute left-1/2 top-1/2 h-[56.25vw] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2 [&_iframe]:h-full [&_iframe]:w-full [&_span]:!h-full [&_span]:!w-full"
              : "h-full w-full [&_iframe]:h-full [&_iframe]:w-full [&_span]:!h-full [&_span]:!w-full"
          }
        >
          <div
            className="fb-video h-full w-full"
            data-href={plan.href}
            data-width={cover ? "1280" : "560"}
            data-show-text="false"
            data-allowfullscreen="false"
            data-autoplay={playing ? "true" : "false"}
            data-lazy="false"
          />
        </div>
        {cover ? <span className="absolute inset-0 z-[3]" aria-hidden /> : null}
      </div>
    );
  }

  const src = embedPlaybackUrl(plan.embed, "facebook", playing, muted, true);
  return (
    <>
      <iframe
        src={src}
        title={title}
        className={socialEmbedFrameClass("facebook", cover, "video", "landscape", cover)}
        referrerPolicy="no-referrer-when-downgrade"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share"
        tabIndex={cover ? -1 : 0}
      />
      {cover ? <span className="absolute inset-0 z-[3]" aria-hidden /> : null}
    </>
  );
}
