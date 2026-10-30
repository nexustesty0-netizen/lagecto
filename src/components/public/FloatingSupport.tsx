import Link from "next/link";
import { Headphones } from "lucide-react";

export function FloatingSupport() {
  return (
    <Link
      href="/support"
      className="fixed bottom-24 right-4 z-20 hidden items-center gap-2 rounded-full bg-[#0B6E4F] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(11,110,79,0.3)] hover:bg-[#095c42] sm:inline-flex lg:bottom-6"
    >
      <Headphones className="h-4 w-4" aria-hidden />
      Support
    </Link>
  );
}
