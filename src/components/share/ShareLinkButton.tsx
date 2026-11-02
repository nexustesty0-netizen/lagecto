"use client";

import { useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import { shareLinks } from "@/lib/share-preview";

export function ShareLinkButton({
  url,
  title,
  body,
  label = "Share",
  compact = false,
}: {
  url: string;
  title: string;
  body?: string | null;
  label?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const links = url ? shareLinks(url, title, body) : null;

  useEffect(() => {
    setCanNativeShare(typeof navigator.share === "function");
  }, []);

  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  async function nativeShare() {
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({ title, text: body || title, url });
        return;
      } catch {
        // cancelled
      }
    }
    setOpen(true);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={
          compact
            ? "grid h-10 w-10 place-items-center rounded-full border border-white/25 bg-[#0B6E4F] text-white"
            : "inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--lagecto-border)] bg-white px-4 py-2 text-sm font-semibold"
        }
        aria-label={label}
      >
        <Share2 size={16} />
        {compact ? null : label}
      </button>
      {open && links ? (
        <div className="absolute right-0 z-30 mt-2 w-[min(14rem,calc(100vw-2rem))] rounded-2xl border bg-white p-3 text-sm text-[#12241c] shadow-lg">
          <p className="mb-2 font-semibold">Share this story</p>
          <div className="grid gap-1">
            {canNativeShare ? (
              <button type="button" onClick={() => void nativeShare()} className="rounded-lg px-2 py-1.5 text-left hover:bg-[#F7F3E3]">
                Share…
              </button>
            ) : null}
            <a href={links.whatsapp} target="_blank" rel="noreferrer" className="rounded-lg px-2 py-1.5 hover:bg-[#F7F3E3]">
              WhatsApp
            </a>
            <a href={links.facebook} target="_blank" rel="noreferrer" className="rounded-lg px-2 py-1.5 hover:bg-[#F7F3E3]">
              Facebook
            </a>
            <a href={links.x} target="_blank" rel="noreferrer" className="rounded-lg px-2 py-1.5 hover:bg-[#F7F3E3]">
              X
            </a>
            <button type="button" onClick={() => void copyLink()} className="rounded-lg px-2 py-1.5 text-left hover:bg-[#F7F3E3]">
              {copied ? "Link copied" : "Copy link"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2 py-1.5 text-left text-[#6B7280]">
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
