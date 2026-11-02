"use client";

import { useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import { storefrontShareLinks, storefrontShareUrl } from "@/lib/storefront/socials";

export function ShareStorefrontButton({
  slug,
  shopName,
  compact = false,
}: {
  slug: string;
  shopName: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setUrl(storefrontShareUrl(window.location.origin, slug));
    setCanNativeShare(typeof navigator.share === "function");
  }, [slug]);

  const links = url ? storefrontShareLinks(url, shopName) : null;

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
        await navigator.share({ title: `${shopName} on LaGecto`, text: `Visit ${shopName} on LaGecto`, url });
        return;
      } catch {
        // User cancelled or share failed; keep the panel open.
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
            ? "sf-icon-btn"
            : "min-h-11 w-full rounded-full border bg-white px-4 py-2 text-sm font-semibold text-[#1E1E1E] sm:w-auto"
        }
        aria-label={`Share ${shopName}`}
      >
        {compact ? <Share2 size={18} /> : "Share storefront"}
      </button>
      {open && links ? (
        <div className="absolute right-0 z-30 mt-2 w-[min(14rem,calc(100vw-2rem))] rounded-2xl border bg-white p-3 text-sm shadow-lg" style={{ color: "#1E1E1E" }}>
          <p className="mb-2 font-semibold">Share this shop</p>
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
            <a href={links.linkedin} target="_blank" rel="noreferrer" className="rounded-lg px-2 py-1.5 hover:bg-[#F7F3E3]">
              LinkedIn
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
