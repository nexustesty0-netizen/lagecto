"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BRAND } from "@/lib/brand";

export type ErrorScreenKind = "not-found" | "forbidden" | "error";

const COPY: Record<
  ErrorScreenKind,
  { code: string; title: string; body: string; homeLabel: string }
> = {
  "not-found": {
    code: "404",
    title: "This page isn't here",
    body: "The link may be out of date, or this page does not exist. You can go back or return to the LaGecto home page.",
    homeLabel: "Go home",
  },
  forbidden: {
    code: "403",
    title: "You don't have access",
    body: "This area isn't available for your account. You can go back, open your dashboard, or return home.",
    homeLabel: "Go home",
  },
  error: {
    code: "Error",
    title: "Something went wrong",
    body: "We couldn't load this page. Try again, or go back and continue from there. No private account details are shown here.",
    homeLabel: "Go home",
  },
};

function goBack(router: ReturnType<typeof useRouter>) {
  if (typeof window !== "undefined" && window.history.length > 1) {
    router.back();
    return;
  }
  router.push("/");
}

export function ErrorScreen({
  kind,
  compact = false,
  onRetry,
  reference,
}: {
  kind: ErrorScreenKind;
  compact?: boolean;
  onRetry?: () => void;
  reference?: string;
}) {
  const router = useRouter();
  const copy = COPY[kind];
  const shell = compact
    ? "flex min-h-[min(32rem,70dvh)] items-center justify-center px-4 py-10"
    : "flex min-h-[100dvh] items-center justify-center px-4 py-10 sm:py-16";

  return (
    <div id="main" className={shell}>
      <div className="lg-page w-full max-w-lg">
        <div className="lg-quiet-cover mb-5 flex items-center gap-3 rounded-[var(--lg-radius)] px-4 py-3 sm:mb-6 sm:px-5 sm:py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.png" alt={`${BRAND.name} logo`} width={44} height={44} className="h-11 w-11 rounded-xl bg-white object-contain p-0.5" />
          <div className="min-w-0 text-left">
            <p className="truncate text-base font-semibold tracking-tight text-[var(--lagecto-text)]">{BRAND.name}</p>
            <p className="text-[11px] text-[var(--lagecto-muted)]">{BRAND.tagline}</p>
          </div>
        </div>

        <article className="lg-card px-5 py-7 text-center sm:px-8 sm:py-9">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#D4AF37]">{copy.code}</p>
          <h1 className="mt-3 text-[1.55rem] font-semibold tracking-tight text-[var(--lagecto-text)] sm:text-3xl">
            {copy.title}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--lagecto-muted)] sm:text-[0.95rem] sm:leading-7">
            {copy.body}
          </p>
          {kind === "error" && reference ? (
            <p className="mt-3 text-xs text-[var(--lagecto-muted)]">
              Reference <span className="font-medium text-[var(--lagecto-text)]">{reference}</span>
            </p>
          ) : null}

          <div className="mt-7 flex flex-col gap-2.5 sm:mt-8 sm:flex-row sm:justify-center">
            {onRetry ? (
              <button type="button" onClick={onRetry} className="lg-btn">
                Try again
              </button>
            ) : null}
            <button type="button" onClick={() => goBack(router)} className="lg-btn-secondary">
              Go back
            </button>
            <Link href="/" className={onRetry ? "lg-btn-secondary" : "lg-btn"}>
              {copy.homeLabel}
            </Link>
            {kind === "forbidden" ? (
              <Link href="/app" className="lg-btn-secondary">
                Your dashboard
              </Link>
            ) : null}
          </div>
        </article>
      </div>
    </div>
  );
}
