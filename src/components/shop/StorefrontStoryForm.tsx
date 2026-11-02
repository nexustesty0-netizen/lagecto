"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { sanitizeHttpUrl } from "@/lib/storefront/socials";

export type StorefrontStoryShop = {
  id: string;
  mission?: string | null;
  vision?: string | null;
  aim?: string | null;
  core_values?: string | null;
  service_delivery?: string | null;
  website_url?: string | null;
  facebook_url?: string | null;
  youtube_url?: string | null;
  instagram_url?: string | null;
  tiktok_url?: string | null;
  linkedin_url?: string | null;
  twitter_url?: string | null;
  whatsapp_number?: string | null;
  privacy_policy?: string | null;
  terms_of_service?: string | null;
};

function field(form: FormData, name: string) {
  return String(form.get(name) || "").trim();
}

export function StorefrontStoryForm({ shop }: { shop: StorefrontStoryShop }) {
  const [message, setMessage] = useState("");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const supabase = createBrowserSupabase();
    const { error } = await supabase
      .from("shops")
      .update({
        mission: field(form, "mission"),
        vision: field(form, "vision"),
        aim: field(form, "aim"),
        core_values: field(form, "core_values"),
        service_delivery: field(form, "service_delivery"),
        website_url: sanitizeHttpUrl(field(form, "website_url")) || null,
        facebook_url: sanitizeHttpUrl(field(form, "facebook_url")) || null,
        youtube_url: sanitizeHttpUrl(field(form, "youtube_url")) || null,
        instagram_url: sanitizeHttpUrl(field(form, "instagram_url")) || null,
        tiktok_url: sanitizeHttpUrl(field(form, "tiktok_url")) || null,
        linkedin_url: sanitizeHttpUrl(field(form, "linkedin_url")) || null,
        twitter_url: sanitizeHttpUrl(field(form, "twitter_url")) || null,
        whatsapp_number: field(form, "whatsapp_number") || null,
        privacy_policy: field(form, "privacy_policy") || null,
        terms_of_service: field(form, "terms_of_service") || null,
      })
      .eq("id", shop.id);
    setMessage(error ? "Unable to save story and links." : "Story and links saved.");
  }

  return (
    <form onSubmit={save} className="grid gap-6 lg:grid-cols-2">
      <section className="lg-card grid gap-3 p-5">
        <h2 className="font-semibold">Mission, vision and how you work</h2>
        <p className="text-sm text-[var(--lagecto-muted)]">These appear on your public storefront About page and home page.</p>
        <label className="grid gap-1 text-sm">
          Mission
          <textarea name="mission" defaultValue={shop.mission || ""} className="min-h-24 rounded-xl border px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          Vision
          <textarea name="vision" defaultValue={shop.vision || ""} className="min-h-24 rounded-xl border px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          Aim
          <textarea name="aim" defaultValue={shop.aim || ""} className="min-h-20 rounded-xl border px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          Core values
          <textarea name="core_values" defaultValue={shop.core_values || ""} className="min-h-24 rounded-xl border px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          Service delivery / how we work
          <textarea name="service_delivery" defaultValue={shop.service_delivery || ""} className="min-h-24 rounded-xl border px-3 py-2" />
        </label>
      </section>
      <section className="lg-card grid gap-3 p-5">
        <h2 className="font-semibold">Website and social links</h2>
        <p className="text-sm text-[var(--lagecto-muted)]">Optional. Add only the pages you want customers to open from your storefront.</p>
        <label className="grid gap-1 text-sm">
          Website
          <input name="website_url" defaultValue={shop.website_url || ""} placeholder="https://yourbusiness.com" className="rounded-xl border px-3 py-2" />
          <span className="text-xs text-[var(--lagecto-muted)]">Shown as a globe icon on your storefront, next to your social links.</span>
        </label>
        <label className="grid gap-1 text-sm">
          Facebook
          <input name="facebook_url" defaultValue={shop.facebook_url || ""} className="rounded-xl border px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          Instagram
          <input name="instagram_url" defaultValue={shop.instagram_url || ""} className="rounded-xl border px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          YouTube
          <input name="youtube_url" defaultValue={shop.youtube_url || ""} className="rounded-xl border px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          TikTok
          <input name="tiktok_url" defaultValue={shop.tiktok_url || ""} className="rounded-xl border px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          LinkedIn
          <input name="linkedin_url" defaultValue={shop.linkedin_url || ""} className="rounded-xl border px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          X / Twitter
          <input name="twitter_url" defaultValue={shop.twitter_url || ""} className="rounded-xl border px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          WhatsApp number
          <input name="whatsapp_number" defaultValue={shop.whatsapp_number || ""} placeholder="+27 82 123 4567" className="rounded-xl border px-3 py-2" />
          <span className="text-xs text-[var(--lagecto-muted)]">Used for the storefront WhatsApp button and for checkout.</span>
        </label>
        <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Save story and links</button>
        {message ? <p className="text-sm text-[#0B6E4F]">{message}</p> : null}
      </section>
      <section className="lg-card grid gap-3 p-5 lg:col-span-2">
        <h2 className="font-semibold">Privacy and terms</h2>
        <p className="text-sm text-[var(--lagecto-muted)]">
          Optional. These appear in your storefront footer and on your shop’s Privacy and Terms pages.
        </p>
        <label className="grid gap-1 text-sm">
          Privacy policy
          <textarea name="privacy_policy" defaultValue={shop.privacy_policy || ""} className="min-h-36 rounded-xl border px-3 py-2" placeholder="How this shop uses customer information." />
        </label>
        <label className="grid gap-1 text-sm">
          Terms of service
          <textarea name="terms_of_service" defaultValue={shop.terms_of_service || ""} className="min-h-36 rounded-xl border px-3 py-2" placeholder="How orders, refunds and visits work with this shop." />
        </label>
      </section>
    </form>
  );
}
