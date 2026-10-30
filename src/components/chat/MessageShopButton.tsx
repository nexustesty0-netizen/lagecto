"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MessageShopButton({
  shopId,
  shopName,
  loggedIn,
}: {
  shopId: string;
  shopName: string;
  loggedIn: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function start() {
    if (!loggedIn) {
      router.push(`/login?next=/customer/shops/${shopId}`);
      return;
    }
    setBusy(true);
    setError("");
    const res = await fetch("/api/chat/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "shop_customer", shopId }),
    });
    const data = await res.json();
    setBusy(false);
    if (data.conversation_id) router.push(`/customer/chat?c=${data.conversation_id}`);
    else setError(data.error || `Unable to message ${shopName}.`);
  }

  return (
    <div>
      <button type="button" disabled={busy} onClick={() => void start()} className="rounded-full bg-[#0B6E4F] px-5 py-2.5 text-sm font-semibold text-white">
        {busy ? "Opening…" : `Message ${shopName}`}
      </button>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
