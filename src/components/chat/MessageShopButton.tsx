"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MessageShopButton({
  shopId,
  shopName,
  loggedIn,
  productId,
  productName,
  nextPath,
}: {
  shopId: string;
  shopName: string;
  loggedIn: boolean;
  productId?: string;
  productName?: string;
  nextPath?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const label = productName ? `Enquire about ${productName}` : `Message ${shopName}`;

  async function start() {
    if (!loggedIn) {
      router.push(`/login?next=${encodeURIComponent(nextPath || `/customer/shops/${shopId}`)}`);
      return;
    }
    setBusy(true);
    setError("");
    const res = await fetch("/api/chat/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "shop_customer", shopId, productId }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (data.conversation_id) router.push(`/customer/chat?c=${data.conversation_id}`);
    else setError(data.error || `Unable to message ${shopName}.`);
  }

  return (
    <div>
      <button type="button" disabled={busy} onClick={() => void start()} className="sf-btn w-full min-h-11 px-5 text-sm">
        {busy ? "Opening…" : label}
      </button>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
