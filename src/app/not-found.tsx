import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 text-center">
      <div className="relative mb-5 h-28 w-28 overflow-hidden rounded-3xl">
        <Image src="/visuals/empty-still.png" alt="" fill sizes="112px" className="object-cover" />
      </div>
      <p className="text-sm font-semibold text-[#D4AF37]">404</p>
      <h1 className="mt-2 text-3xl font-semibold">Page not found</h1>
      <p className="mt-2 text-[var(--lagecto-muted)]">This LaGecto page does not exist.</p>
      <Link href="/" className="mt-6 rounded-full bg-[#0B6E4F] px-5 py-2 text-white">
        Go home
      </Link>
    </div>
  );
}
