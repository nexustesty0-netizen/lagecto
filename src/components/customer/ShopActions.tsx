"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function SaveShopButton({ shopId, saved }: { shopId: string; saved: boolean }) {
  const router = useRouter();
  async function toggle() {
    const supabase = createBrowserSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    if (saved) await supabase.from("saved_shops").delete().eq("user_id", user.id).eq("shop_id", shopId);
    else await supabase.from("saved_shops").insert({ user_id: user.id, shop_id: shopId });
    router.refresh();
  }
  return (
    <button type="button" onClick={toggle} className="rounded-full border px-4 py-2 text-sm">
      {saved ? "Saved" : "Save shop"}
    </button>
  );
}

export function BookingForm({ shopId, services }: { shopId: string; services: { id: string; name: string }[] }) {
  const router = useRouter();
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const supabase = createBrowserSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("service_bookings").insert({
      shop_id: shopId,
      product_id: form.get("product_id") || null,
      customer_id: user?.id,
      scheduled_at: String(form.get("scheduled_at") || ""),
      notes: String(form.get("notes") || ""),
      status: "pending",
    });
    event.currentTarget.reset();
    router.refresh();
  }
  return (
    <form onSubmit={onSubmit} className="mt-3 grid gap-2 rounded-xl bg-[#F7F3E3] p-3">
      <select name="product_id" className="rounded-xl border px-3 py-2">
        <option value="">Any service</option>
        {services.map((service) => (
          <option key={service.id} value={service.id}>
            {service.name}
          </option>
        ))}
      </select>
      <input name="scheduled_at" type="datetime-local" required className="rounded-xl border px-3 py-2" />
      <input name="notes" placeholder="Notes" className="rounded-xl border px-3 py-2" />
      <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Request booking</button>
    </form>
  );
}

export function RequestForm({ shopId }: { shopId: string }) {
  const router = useRouter();
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const supabase = createBrowserSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("service_requests").insert({
      shop_id: shopId,
      customer_id: user?.id,
      title: String(form.get("title") || ""),
      details: String(form.get("details") || ""),
    });
    event.currentTarget.reset();
    router.refresh();
  }
  return (
    <form onSubmit={onSubmit} className="mt-3 grid gap-2 rounded-xl bg-[#F7F3E3] p-3">
      <input name="title" required placeholder="What do you need?" className="rounded-xl border px-3 py-2" />
      <textarea name="details" placeholder="Details" className="min-h-20 rounded-xl border px-3 py-2" />
      <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Send request</button>
    </form>
  );
}
