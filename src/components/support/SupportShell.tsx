import Link from "next/link";
import { SupportNav } from "@/components/support/SupportNav";
import { SupportSearch } from "@/components/support/SupportSearch";
import { MARKETPLACE_IMAGES } from "@/lib/public-catalog";

export function SupportShell({
  basePath,
  current,
  children,
  showSearch = false,
}: {
  basePath: string;
  current: string;
  children: React.ReactNode;
  variant?: "hero" | "quiet";
  showSearch?: boolean;
}) {
  return (
    <div className="lg-support-hub">
      <section className="lg-support-hero sf-hero-frame relative isolate min-h-[20rem] overflow-hidden sm:min-h-[26rem] lg:min-h-[30rem]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MARKETPLACE_IMAGES.supportHero} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B6E4F]/82 via-[#0B6E4F]/55 to-[#0B6E4F]/32" />
        <div className="relative z-[2] mx-auto flex min-h-[20rem] w-full max-w-5xl flex-col justify-center px-4 py-14 sm:min-h-[26rem] sm:px-8 sm:py-20 lg:min-h-[30rem]">
          <p className="os-kicker text-[#D4AF37]">Help & Support</p>
          <h1 className="mt-2 max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">How can we help you?</h1>
          <p className="mt-3 max-w-xl text-white/90">Find answers, report problems, contact support, or read LaGecto policies.</p>
          {showSearch ? (
            <div className="mt-8">
              <SupportSearch basePath={basePath} />
            </div>
          ) : null}
        </div>
      </section>
      <div className="mx-auto max-w-5xl px-4 pt-6">
        <SupportNav basePath={basePath} current={current} />
      </div>
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
