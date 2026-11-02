import { createServerSupabase } from "@/lib/supabase/server";
import Link from "next/link";

export async function FoundingUsersBanner({
  href = "/register-shop",
  cta = "Become a Founding User",
  force = false,
}: {
  href?: string;
  cta?: string;
  force?: boolean;
}) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("active_founding_campaign");
  if (!data?.ok && !force) return null;
  const remaining = data?.remaining == null ? null : Number(data.remaining);
  const limit = Number(data?.limit || 10);
  const spotsOpen = remaining == null || remaining > 0;
  const isHash = href.startsWith("#");
  const className = "mt-4 inline-flex min-h-11 items-center rounded-full bg-[#0B6E4F] px-5 py-2 text-sm font-semibold text-white";
  return (
    <aside className="lg-card mb-8 overflow-hidden p-6">
      <p className="os-kicker">Promotional offer</p>
      <h2 className="mt-2 text-2xl font-semibold">{data?.name || "Founding Users"}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--lagecto-muted)]">
        Complimentary listing for 1 month and 3 weeks. After that you have 5 days to pay. If you do not pay, the shop is deactivated and removed from Shops.
      </p>
      {remaining != null ? (
        <p className="mt-2 text-sm font-medium text-[#0B6E4F]">
          {remaining} of {limit} founding spots left
        </p>
      ) : null}
      {spotsOpen ? (
        isHash ? (
          <a href={href} className={className}>
            {cta}
          </a>
        ) : (
          <Link href={href} className={className}>
            {cta}
          </Link>
        )
      ) : null}
    </aside>
  );
}
