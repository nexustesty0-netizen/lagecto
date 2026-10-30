"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function UnlockButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function unlock() {
    if (!confirm("Unlock this account?")) return;
    setBusy(true);
    await fetch("/api/admin/security", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unlock_account", userId }),
    });
    setBusy(false);
    router.refresh();
  }
  return (
    <button disabled={busy} onClick={unlock} className="rounded-lg bg-[#0B6E4F] px-3 py-1 text-sm text-white">
      Unlock / Unban
    </button>
  );
}
