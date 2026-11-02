"use client";

import { useState } from "react";
import type { Profile } from "@/lib/types";

const REASONS = [
  "I no longer need this account",
  "I am switching to a different account",
  "Privacy concerns",
  "Too many emails or notifications",
  "The shop is closing",
  "Other",
];

export function DeleteAccountCard({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const shopOwner = profile.role === "shop_owner";

  if (profile.role === "admin") return null;

  async function confirmDelete() {
    const why = reason === "Other" ? details.trim() : [reason, details.trim()].filter(Boolean).join(" — ");
    if (!reason) {
      setError("Choose why you are deleting this account.");
      return;
    }
    if (why.length < 8) {
      setError("Please add a short explanation.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: why }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Unable to delete this account.");
        setBusy(false);
        return;
      }
      window.location.assign("/login?logged_out=1");
    } catch {
      setError("Network error. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <article className="lg-card grid gap-3 p-5">
      <h2 className="font-semibold text-[#C2413B]">Delete account</h2>
      <p className="text-sm text-[var(--lagecto-muted)]">
        This permanently signs you out and closes the account.
        {shopOwner ? " Your shop will also be removed from the public shops list." : ""}
      </p>
      <button
        type="button"
        className="w-fit rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-[#C2413B]"
        onClick={() => {
          setOpen(true);
          setError("");
        }}
      >
        Delete my account
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#12241c]/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="lg-card grid w-full max-w-md gap-3 p-5">
            <h3 className="text-lg font-semibold">Why are you deleting this account?</h3>
            <p className="text-sm text-[var(--lagecto-muted)]">
              Tell us the reason first. This cannot be undone.
              {shopOwner ? " The shop will no longer appear on LaGecto." : ""}
            </p>
            <label className="grid gap-1 text-sm">
              Reason
              <select value={reason} onChange={(event) => setReason(event.target.value)} className="rounded-xl border px-3 py-2">
                <option value="">Choose a reason</option>
                {REASONS.filter((item) => item !== "The shop is closing" || shopOwner).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              {reason === "Other" ? "Please explain" : "More detail"}
              <textarea
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                required={reason === "Other"}
                placeholder={reason === "Other" ? "Tell us why" : "Optional extra detail"}
                className="min-h-24 rounded-xl border px-3 py-2"
              />
            </label>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="mt-1 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full border px-4 py-2 text-sm"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full bg-[#C2413B] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                onClick={() => void confirmDelete()}
                disabled={busy}
              >
                {busy ? "Deleting…" : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
