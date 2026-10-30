"use client";

import { useState } from "react";
import type { Profile } from "@/lib/types";
import { usernameChangeReadyAt } from "@/lib/validation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function ProfileSettingsForm({ profile }: { profile: Profile }) {
  const [message, setMessage] = useState("");
  const nextUsername = usernameChangeReadyAt(profile.last_username_change_at);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const supabase = createBrowserSupabase();
    const { error } = await supabase
      .from("users")
      .update({
        name: String(form.get("name") || ""),
        phone: String(form.get("phone") || ""),
        address: String(form.get("address") || ""),
      })
      .eq("id", profile.id);
    setMessage(error ? "Unable to save profile." : "Profile saved.");
    if (!error) {
      await fetch("/api/loyalty/evaluate", { method: "POST" }).catch(() => undefined);
    }
  }

  async function saveUsername(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/profile/username", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.get("username") }),
    });
    const data = await res.json();
    setMessage(data.error || "Username updated.");
  }

  return (
    <div className="grid max-w-xl gap-6">
      <form onSubmit={saveProfile} className="lg-card grid gap-3 p-5">
        <label className="grid gap-1 text-sm">
          Full name
          <input name="name" defaultValue={profile.name || ""} className="rounded-xl border px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          Phone
          <input name="phone" defaultValue={profile.phone || ""} className="rounded-xl border px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          Address
          <input name="address" defaultValue={profile.address || ""} className="rounded-xl border px-3 py-2" />
        </label>
        <p className="text-sm text-[#6B7280]">Email: {profile.email}</p>
        <p className="text-sm text-[#6B7280]">Role: {profile.role} (cannot be changed)</p>
        <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Save profile</button>
      </form>
      <form onSubmit={saveUsername} className="lg-card grid gap-3 p-5">
        <label className="grid gap-1 text-sm">
          Username
          <input name="username" defaultValue={profile.username || ""} className="rounded-xl border px-3 py-2" />
        </label>
        <p className="text-sm text-[#6B7280]">
          {nextUsername && nextUsername > new Date()
            ? `You can change your username again on ${nextUsername.toLocaleDateString()}.`
            : "Username changes are limited to once every 14 days."}
        </p>
        <button className="rounded-xl border px-4 py-2">Change username</button>
      </form>
      {message ? <p className="text-sm text-[#0B6E4F]">{message}</p> : null}
    </div>
  );
}
