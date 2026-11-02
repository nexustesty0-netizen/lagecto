"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function StartPeriodButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function start() {
    if (busy) return;
    setBusy(true);
    setOpen(false);
    const res = await fetch("/api/shop/financials/period", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <>
      <button disabled={busy} onClick={() => setOpen(true)} className="rounded-full bg-[#0B6E4F] px-4 py-2 text-white disabled:opacity-50">
        {busy ? "Starting…" : "Start new financial period"}
      </button>
      <ConfirmDialog
        open={open}
        title="Start a new period?"
        body="Archive the current period and start a new one at zero. Existing records stay available in Archives."
        confirmLabel="Start new period"
        onCancel={() => setOpen(false)}
        onConfirm={() => void start()}
      />
    </>
  );
}
