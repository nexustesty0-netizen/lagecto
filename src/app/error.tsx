"use client";

import Image from "next/image";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 text-center">
      <div className="relative mb-5 h-28 w-28 overflow-hidden rounded-3xl">
        <Image src="/visuals/empty-still.png" alt="" fill sizes="112px" className="object-cover" />
      </div>
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-[var(--lagecto-muted)]">
        The request could not be completed. If you just set up the site, confirm the new Supabase project environment variables.
      </p>
      <button onClick={reset} className="mt-6 rounded-full bg-[#0B6E4F] px-5 py-2 text-white">
        Try again
      </button>
    </div>
  );
}
