"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function VerificationApply({ shopId }: { shopId: string }) {
  const router = useRouter();
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const supabase = createBrowserSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("verification_requests").insert({
      shop_id: shopId,
      submitted_by: user?.id,
      notes: String(form.get("notes") || ""),
      status: "pending",
    });
    event.currentTarget.reset();
    router.refresh();
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl bg-white p-4">
      <textarea name="notes" required placeholder="Tell us about your business documents and details." className="min-h-24 rounded-xl border px-3 py-2" />
      <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Apply for verification</button>
    </form>
  );
}
