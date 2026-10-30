"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function CompanyForm({
  profile,
}: {
  profile: {
    company_name: string;
    tagline: string | null;
    about: string | null;
    mission: string | null;
    vision: string | null;
    support_email: string | null;
    support_phone: string | null;
    location: string | null;
  };
}) {
  const router = useRouter();
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const supabase = createBrowserSupabase();
    await supabase
      .from("lagecto_company_profile")
      .update({
        company_name: String(form.get("company_name") || "LaGecto"),
        tagline: String(form.get("tagline") || ""),
        about: String(form.get("about") || ""),
        mission: String(form.get("mission") || ""),
        vision: String(form.get("vision") || ""),
        support_email: String(form.get("support_email") || ""),
        support_phone: String(form.get("support_phone") || ""),
        location: String(form.get("location") || ""),
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    router.refresh();
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl bg-white p-4">
      <input name="company_name" defaultValue={profile.company_name} className="rounded-xl border px-3 py-2" />
      <input name="tagline" defaultValue={profile.tagline || ""} className="rounded-xl border px-3 py-2" />
      <textarea name="about" defaultValue={profile.about || ""} className="min-h-24 rounded-xl border px-3 py-2" />
      <textarea name="mission" defaultValue={profile.mission || ""} className="min-h-20 rounded-xl border px-3 py-2" />
      <textarea name="vision" defaultValue={profile.vision || ""} className="min-h-20 rounded-xl border px-3 py-2" />
      <input name="support_email" defaultValue={profile.support_email || ""} className="rounded-xl border px-3 py-2" />
      <input name="support_phone" defaultValue={profile.support_phone || ""} className="rounded-xl border px-3 py-2" />
      <input name="location" defaultValue={profile.location || ""} className="rounded-xl border px-3 py-2" />
      <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Save company profile</button>
    </form>
  );
}
