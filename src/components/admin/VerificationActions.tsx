"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function VerificationActions({
  table,
  id,
}: {
  table: "verification_requests" | "shop_registration_requests";
  id: string;
}) {
  const router = useRouter();
  async function setStatus(status: string) {
    const supabase = createBrowserSupabase();
    await supabase.from(table).update({ status }).eq("id", id);
    router.refresh();
  }
  return (
    <div className="mt-3 flex gap-2">
      <button type="button" className="rounded-lg bg-[#0B6E4F] px-3 py-1 text-sm text-white" onClick={() => setStatus("approved")}>
        Approve
      </button>
      <button type="button" className="rounded-lg border px-3 py-1 text-sm" onClick={() => setStatus("rejected")}>
        Reject
      </button>
    </div>
  );
}

export function ShopRegistrationActions({
  id,
  status,
  notes,
}: {
  id: string;
  status: string;
  notes?: string | null;
}) {
  const router = useRouter();
  const [adminNotes, setAdminNotes] = useState(notes || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save(nextStatus?: string) {
    setSaving(true);
    setMessage("");
    const supabase = createBrowserSupabase();
    const patch: Record<string, string> = {
      admin_notes: adminNotes.trim(),
      updated_at: new Date().toISOString(),
    };
    if (nextStatus) patch.status = nextStatus;
    const { error } = await supabase.from("shop_registration_requests").update(patch).eq("id", id);
    setSaving(false);
    if (error) {
      setMessage("Unable to save this request.");
      return;
    }
    setMessage(nextStatus ? `Marked ${nextStatus}.` : "Instructions saved. The requester can see them with their reference number.");
    router.refresh();
  }

  return (
    <div className="mt-4 grid gap-3">
      <label className="grid gap-1 text-sm">
        Instructions for the requester
        <textarea
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          className="min-h-24 rounded-xl border px-3 py-2"
          placeholder="Tell them what to do next — documents needed, Shop ID, login steps, plan, etc."
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={saving} className="rounded-lg border px-3 py-1 text-sm" onClick={() => void save()}>
          Save notes
        </button>
        {status !== "contacted" ? (
          <button type="button" disabled={saving} className="rounded-lg bg-[#0B6E4F] px-3 py-1 text-sm text-white" onClick={() => void save("contacted")}>
            Mark contacted
          </button>
        ) : null}
        <button type="button" disabled={saving} className="rounded-lg bg-[#0B6E4F] px-3 py-1 text-sm text-white" onClick={() => void save("approved")}>
          Approve
        </button>
        <button type="button" disabled={saving} className="rounded-lg border px-3 py-1 text-sm" onClick={() => void save("rejected")}>
          Reject
        </button>
      </div>
      {message ? <p className="text-sm text-[#0B6E4F]">{message}</p> : null}
    </div>
  );
}
