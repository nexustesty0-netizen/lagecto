"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function WeeklyGenerate() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function run() {
    setMessage("Generating…");
    const res = await fetch("/api/admin/stebo-weekly", { method: "POST" });
    const data = await res.json();
    if (!res.ok) setMessage(data.error || "Unable to generate reports.");
    else {
      setMessage(`Created ${data.created || 0}, skipped ${data.skipped || 0} (idempotent for week ${data.week_start || ""}).`);
      router.refresh();
    }
  }
  return (
    <div className="mb-8 rounded-2xl bg-white p-4">
      <h2 className="font-semibold">Weekend platform analytics</h2>
      <p className="mt-1 text-sm text-[#6B7280]">
        Runs Saturday via cron. Shop company sales are never treated as LaGecto revenue. Duplicate weeks are skipped.
      </p>
      <button type="button" onClick={() => void run()} className="mt-3 rounded-full bg-[#0B6E4F] px-4 py-2 text-white">
        Generate last week now
      </button>
      {message ? <p className="mt-2 text-sm text-[#0B6E4F]">{message}</p> : null}
    </div>
  );
}
