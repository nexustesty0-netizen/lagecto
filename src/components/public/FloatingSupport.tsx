import Link from "next/link";
import { Headphones } from "lucide-react";

export function FloatingSupport() {
  return (
    <Link
      href="/support"
      className="lg-btn fixed bottom-24 right-4 z-20 hidden gap-2 sm:inline-flex lg:bottom-6"
    >
      <Headphones className="h-4 w-4" aria-hidden />
      Support
    </Link>
  );
}
