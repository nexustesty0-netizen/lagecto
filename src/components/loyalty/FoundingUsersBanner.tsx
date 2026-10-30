import { createServerSupabase } from "@/lib/supabase/server";
import Link from "next/link";

export async function FoundingUsersBanner({ href = "/register-shop" }: { href?: string }) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("active_founding_campaign");
  if (!data?.ok) return null;
  const months = Number(data.benefit?.duration_months || 3);
  return (
    <aside className="lg-card mb-8 overflow-hidden p-6">
      <p className="os-kicker">Promotional offer</p>
      <h2 className="mt-2 text-2xl font-semibold">{data.name || "Founding Users"}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--lagecto-muted)]">
        {data.description || `List your shop on LaGecto free for ${months} months while this campaign is open.`}
      </p>
      {data.remaining != null ? <p className="mt-2 text-xs text-[var(--lagecto-muted)]">{data.remaining} places remaining.</p> : null}
      <Link href={href} className="mt-4 inline-flex rounded-full bg-[#0B6E4F] px-5 py-2 text-sm font-semibold text-white">
        Become a Founding User
      </Link>
    </aside>
  );
}
