"use client";

import { useState } from "react";
import { PasswordField, PrimaryButton } from "@/components/ui/forms";

export function PasswordChangeForm() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = new FormData(form);
    setBusy(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: payload.get("currentPassword"),
        newPassword: payload.get("newPassword"),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Unable to update password.");
      return;
    }
    form.reset();
    setMessage("Password updated.");
  }

  return (
    <form onSubmit={(event) => void save(event)} className="lg-card grid max-w-xl gap-3 p-5">
      <PasswordField label="Current password" name="currentPassword" required autoComplete="current-password" />
      <PasswordField label="New password" name="newPassword" required minLength={8} autoComplete="new-password" />
      <p className="text-xs text-[var(--lagecto-muted)]">Use at least 8 characters with letters and numbers. We check your current password first.</p>
      <PrimaryButton type="submit" loading={busy} className="w-fit px-5">
        Update password
      </PrimaryButton>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {message ? <p className="text-sm text-[#0B6E4F]">{message}</p> : null}
    </form>
  );
}
