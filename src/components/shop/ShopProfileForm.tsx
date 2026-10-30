"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { sanitizeHttpUrl } from "@/lib/storefront/socials";
import type { Shop } from "@/lib/types";

export function ShopProfileForm({ shop }: { shop: Shop }) {
  const [message, setMessage] = useState("");
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const supabase = createBrowserSupabase();
    const { error } = await supabase
      .from("shops")
      .update({
        about: String(form.get("about") || ""),
        name: String(form.get("name") || shop.name).trim() || shop.name,
        phone: String(form.get("phone") || ""),
        email: String(form.get("email") || ""),
        address: String(form.get("address") || ""),
        whatsapp_number: String(form.get("whatsapp") || ""),
        website_url: sanitizeHttpUrl(String(form.get("website") || "")) || null,
        delivery_time: String(form.get("delivery") || ""),
      })
      .eq("id", shop.id);
    setMessage(error ? "Unable to save shop profile." : "Shop profile saved.");
  }
  return (
    <form onSubmit={onSubmit} className="lg-card grid gap-3 p-5">
      <h2 className="font-semibold">Shop profile</h2>
      <p className="text-sm text-[#6B7280]">Shop ID cannot be edited here.</p>
      <label className="grid gap-1 text-sm">
        Business name
        <input name="name" defaultValue={shop.name} className="rounded-xl border px-3 py-2" />
      </label>
      <label className="grid gap-1 text-sm">
        About
        <textarea name="about" defaultValue={shop.about || ""} className="min-h-24 rounded-xl border px-3 py-2" />
      </label>
      <label className="grid gap-1 text-sm">
        Phone
        <input name="phone" type="tel" defaultValue={shop.phone || ""} className="rounded-xl border px-3 py-2" />
        <span className="text-xs text-[#6B7280]">Printed on receipts as a number, without labelling it as WhatsApp or calls.</span>
      </label>
      <label className="grid gap-1 text-sm">
        Email
        <input name="email" type="email" defaultValue={shop.email || ""} className="rounded-xl border px-3 py-2" />
        <span className="text-xs text-[#6B7280]">Printed on receipts with your phone number.</span>
      </label>
      <label className="grid gap-1 text-sm">
        Address
        <input name="address" defaultValue={shop.address || ""} className="rounded-xl border px-3 py-2" />
      </label>
      <label className="grid gap-1 text-sm">
        WhatsApp
        <input
          name="whatsapp"
          type="tel"
          defaultValue={shop.whatsapp_number || ""}
          placeholder="+263 71 000 0000"
          className="rounded-xl border px-3 py-2"
        />
        <span className="text-xs text-[#6B7280]">
          Used for checkout and the storefront WhatsApp button. Receipts print one number only, without saying WhatsApp.
        </span>
      </label>
      <label className="grid gap-1 text-sm">
        Website
        <input name="website" defaultValue={shop.website_url || ""} placeholder="https://yourbusiness.com" className="rounded-xl border px-3 py-2" />
        <span className="text-xs text-[#6B7280]">Optional. Shown on your storefront and printed on receipts if you add it.</span>
      </label>
      <label className="grid gap-1 text-sm">
        Delivery time
        <input name="delivery" defaultValue={shop.delivery_time || ""} className="rounded-xl border px-3 py-2" />
      </label>
      <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Save shop</button>
      {message ? <p className="text-sm text-[#0B6E4F]">{message}</p> : null}
    </form>
  );
}
