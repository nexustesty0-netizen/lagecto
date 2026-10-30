import Link from "next/link";
import { SupportNav } from "@/components/support/SupportNav";
import { SupportSearch } from "@/components/support/SupportSearch";
import { MARKETPLACE_IMAGES } from "@/lib/public-catalog";

export function SupportShell({
  basePath,
  current,
  children,
  variant = "hero",
  showSearch = false,
}: {
  basePath: string;
  current: string;
  children: React.ReactNode;
  variant?: "hero" | "quiet";
  showSearch?: boolean;
}) {
  if (variant === "quiet") {
    return (
      <div className="lg-support-hub">
        <div className="border-b border-[var(--lagecto-border)] bg-[#073628] text-white">
          <div className="mx-auto max-w-5xl px-4 py-6">
            <p className="os-kicker text-[#D4AF37]">Help & Support</p>
            <SupportNav basePath={basePath} current={current} />
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-4 py-10">{children}</div>
      </div>
    );
  }

  return (
    <div className="lg-support-hub">
      <section className="lg-support-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MARKETPLACE_IMAGES.supportHero} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div className="relative mx-auto max-w-5xl px-4 py-12 sm:py-16">
          <p className="os-kicker text-[#D4AF37]">Help & Support</p>
          <h1 className="mt-2 max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">How can we help you?</h1>
          <p className="mt-3 max-w-xl text-white/85">Find answers, report problems, contact support, or learn more about LaGecto.</p>
          {showSearch ? (
            <div className="mt-8">
              <SupportSearch basePath={basePath} />
            </div>
          ) : null}
          <SupportNav basePath={basePath} current={current} />
        </div>
      </section>
      <div className="mx-auto max-w-5xl px-4 py-10">{children}</div>
    </div>
  );
}

export function SignInHint({ href }: { href: string }) {
  return (
    <p className="rounded-2xl bg-white p-4 text-sm">
      Sign in to send this to Support. You can still call or email us.{" "}
      <Link href={`/login?next=${encodeURIComponent(href)}`} className="font-semibold text-[#0B6E4F]">
        Sign in
      </Link>
    </p>
  );
}
