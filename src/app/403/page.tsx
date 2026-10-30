import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold text-[#D4AF37]">403</p>
      <h1 className="mt-2 text-3xl font-semibold">You don&apos;t have permission</h1>
      <p className="mt-2 text-[var(--lagecto-muted)]">This area of LaGecto is limited to another role.</p>
      <Link href="/app" className="mt-6 rounded-full bg-[#0B6E4F] px-5 py-2 text-white">
        Go to your dashboard
      </Link>
    </div>
  );
}
