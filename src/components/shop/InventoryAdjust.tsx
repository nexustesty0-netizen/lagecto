"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function InventoryAdjust({
  productId,
  shopId,
  current,
}: {
  productId: string;
  shopId: string;
  current: number;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  async function adjust(delta: number) {
    setError("");
    const res = await fetch("/api/shop/inventory/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, shopId, delta }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Unable to adjust stock.");
    router.refresh();
  }
  return (
    <div className="flex items-center gap-2">
      <button type="button" className="rounded-lg border px-3 py-1" onClick={() => adjust(-1)}>
        -1
      </button>
      <button type="button" className="rounded-lg border px-3 py-1" onClick={() => adjust(1)}>
        +1
      </button>
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
    </div>
  );
}
