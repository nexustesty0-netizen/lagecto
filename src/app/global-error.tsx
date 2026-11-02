"use client";

import Link from "next/link";
import { Geist } from "next/font/google";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { BRAND } from "@/lib/brand";
import { logAppError } from "@/lib/safe-log";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export default function GlobalError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    logAppError("global", error);
  }, [error]);

  const recover = () => {
    if (retry) {
      retry();
      return;
    }
    if (reset) {
      reset();
      return;
    }
    router.push("/");
  };

  const reference = typeof error?.digest === "string" ? error.digest : "";

  return (
    <html lang="en" className={`${geistSans.variable} h-full`}>
      <body className="min-h-full bg-cream text-foreground antialiased">
        <main className="flex min-h-[100dvh] items-center justify-center px-4 py-10">
          <div className="w-full max-w-lg">
            <div className="lg-quiet-cover mb-5 flex items-center gap-3 rounded-[var(--lg-radius)] px-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/logo.png"
                alt={`${BRAND.name} logo`}
                width={44}
                height={44}
                className="h-11 w-11 rounded-xl bg-white object-contain p-0.5"
              />
              <div>
                <p className="text-base font-semibold tracking-tight">{BRAND.name}</p>
                <p className="text-[11px] text-[var(--lagecto-muted)]">{BRAND.tagline}</p>
              </div>
            </div>
            <article className="lg-card px-5 py-7 text-center sm:px-8 sm:py-9">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#D4AF37]">Error</p>
              <h1 className="mt-3 text-[1.55rem] font-semibold tracking-tight sm:text-3xl">LaGecto could not load</h1>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--lagecto-muted)]">
                Something unexpected happened. Try again, or go home. No private account details are shown here.
              </p>
              {reference ? (
                <p className="mt-3 text-xs text-[var(--lagecto-muted)]">
                  Reference <span className="font-medium text-[var(--lagecto-text)]">{reference}</span>
                </p>
              ) : null}
              <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
                <button type="button" onClick={recover} className="lg-btn">
                  Try again
                </button>
                <Link href="/" className="lg-btn-secondary">
                  Go home
                </Link>
              </div>
            </article>
          </div>
        </main>
      </body>
    </html>
  );
}
