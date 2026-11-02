"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function UnlockButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function unlock() {
    if (busy) return;
    setBusy(true);
    setOpen(false);
    await fetch("/api/admin/security", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unlock_account", userId }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <>
      <button disabled={busy} onClick={() => setOpen(true)} className="rounded-lg bg-[#0B6E4F] px-3 py-1 text-sm text-white disabled:opacity-50">
        {busy ? "Unlocking…" : "Unlock / Unban"}
      </button>
      <ConfirmDialog
        open={open}
        title="Unlock this account?"
        body="The person will be able to sign in again immediately."
        confirmLabel="Unlock account"
        onCancel={() => setOpen(false)}
        onConfirm={() => void unlock()}
      />
    </>
  );
}
