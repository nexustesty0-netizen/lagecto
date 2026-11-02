"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MediaField } from "@/components/media/MediaField";
import { MediaPreview } from "@/components/media/MediaPreview";

type Item = { id: string; url: string; alt_text: string | null };

export function GalleryManager({ shopId, items }: { shopId: string; items: Item[] }) {
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [pending, setPending] = useState<Item | null>(null);

  async function add() {
    if (!url) return;
    const supabase = createBrowserSupabase();
    await supabase.from("storefront_media").insert({ shop_id: shopId, url, source: "upload", sort_order: items.length });
    setUrl(null);
    router.refresh();
  }

  async function remove() {
    if (!pending) return;
    const supabase = createBrowserSupabase();
    await supabase.from("storefront_media").delete().eq("id", pending.id).eq("shop_id", shopId);
    setPending(null);
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <div className="lg-card grid gap-3 p-5">
        <MediaField
          label="Gallery image"
          purpose="media"
          value={url}
          onChange={setUrl}
          hint="Upload a photo, or paste an image URL or an Instagram, TikTok, Facebook, or YouTube link. The preview stays on LaGecto."
        />
        <button type="button" onClick={() => void add()} className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">
          Add to gallery
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <figure key={item.id} className="overflow-hidden rounded-2xl bg-white">
            <MediaPreview url={item.url} title={item.alt_text || "Gallery item"} className="aspect-square w-full" fit="cover" />
            <button type="button" className="w-full py-2 text-sm text-[#C2413B]" onClick={() => setPending(item)}>
              Remove
            </button>
          </figure>
        ))}
      </div>
      <ConfirmDialog open={Boolean(pending)} title="Remove this image?" body="It will no longer appear in the storefront gallery." onCancel={() => setPending(null)} onConfirm={() => void remove()} />
    </div>
  );
}
