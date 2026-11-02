"use client";

import { useState } from "react";
import type { Profile } from "@/lib/types";
import { usernameChangeReadyAt } from "@/lib/validation";
import { InitialsAvatar } from "@/components/os/OsUi";
import { publicDisplayName } from "@/lib/chat-privacy";
import { DeleteAccountCard } from "@/components/settings/DeleteAccountCard";

export function ProfileSettingsForm({ profile }: { profile: Profile }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const nextUsername = usernameChangeReadyAt(profile.last_username_change_at);
  const display = publicDisplayName(profile.name || profile.username, "Account");
  const accountLabel =
    profile.role === "customer" ? "Customer account" : profile.role === "admin" ? "Admin account" : "Shop owner account";
  const customer = profile.role === "customer";

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        phone: form.get("phone"),
        address: form.get("address"),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Unable to save profile.");
      return;
    }
    setMessage("Profile saved.");
    await fetch("/api/loyalty/evaluate", { method: "POST" }).catch(() => undefined);
  }

  async function saveUsername(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    const res = await fetch("/api/profile/username", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.get("username") }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Unable to change username.");
    else setMessage("Username updated.");
  }

  return (
    <div className="grid max-w-xl gap-6">
      <div className="flex items-center gap-3">
        <InitialsAvatar name={display} photoUrl={profile.avatar_url} size={56} />
        <div>
          <p className="font-semibold">{display}</p>
          <p className="text-sm text-[var(--lagecto-muted)]">{accountLabel}</p>
        </div>
      </div>
      <form onSubmit={(event) => void saveProfile(event)} className="lg-card grid gap-3 p-5">
        <label className="grid gap-1 text-sm">
          Full name
          <input name="name" defaultValue={profile.name || ""} required className="rounded-xl border px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          Phone
          <input name="phone" defaultValue={profile.phone || ""} className="rounded-xl border px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          Address
          <input name="address" defaultValue={profile.address || ""} className="rounded-xl border px-3 py-2" />
        </label>
        <p className="text-sm text-[var(--lagecto-muted)]">Email on this account: {profile.email}</p>
        {!customer ? (
          <p className="text-sm text-[var(--lagecto-muted)]">Role: {profile.role.replace("_", " ")} (cannot be changed here)</p>
        ) : null}
        <button disabled={busy} className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white disabled:opacity-60">
          {busy ? "Saving…" : "Save profile"}
        </button>
      </form>
      <form onSubmit={(event) => void saveUsername(event)} className="lg-card grid gap-3 p-5">
        <label className="grid gap-1 text-sm">
          Username
          <input name="username" defaultValue={profile.username || ""} className="rounded-xl border px-3 py-2" />
        </label>
        <p className="text-sm text-[var(--lagecto-muted)]">
          {nextUsername && nextUsername > new Date()
            ? `You can change your username again on ${nextUsername.toLocaleDateString()}.`
            : "Username changes are limited to once every 14 days."}
        </p>
        <button className="rounded-xl border px-4 py-2">Change username</button>
      </form>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {message ? <p className="text-sm text-[#0B6E4F]">{message}</p> : null}
      {!customer ? <DeleteAccountCard profile={profile} /> : null}
    </div>
  );
}
