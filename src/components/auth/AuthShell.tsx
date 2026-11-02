import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { BRAND } from "@/lib/brand";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <aside className="relative hidden min-h-full overflow-hidden lg:block">
        <Image src="/visuals/login-hero.png" alt="" fill priority sizes="50vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B6E4F] via-[#0B6E4F]/50 to-[#0B6E4F]/18" />
        <div className="absolute inset-x-0 bottom-0 p-10 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#d4af37]">LaGecto</p>
          <p className="mt-3 max-w-sm text-3xl font-semibold leading-tight">{BRAND.tagline}</p>
          <p className="mt-3 max-w-sm text-sm text-white/80">{BRAND.description}</p>
        </div>
      </aside>
      <div className="relative flex min-h-full flex-col justify-center bg-[#F3EEE0] px-4 py-10 sm:px-8">
        <div className="relative mx-auto w-full max-w-[440px] lg-page">
          <Link href="/" className="mb-6 inline-flex items-center gap-3">
            <Logo size={44} />
            <span>
              <span className="block text-lg font-semibold">{BRAND.name}</span>
              <span className="block text-xs text-[var(--lagecto-muted)]">{BRAND.location}</span>
            </span>
          </Link>
          <Link
            href="/marketplace"
            className="mb-5 inline-flex min-h-11 items-center rounded-full border border-[var(--lagecto-border)] bg-white px-4 text-sm font-medium"
          >
            Back to marketplace
          </Link>
          <div className="lg-card p-5 sm:p-8">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle ? <p className="mt-2 text-sm leading-6 text-[var(--lagecto-muted)]">{subtitle}</p> : null}
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
