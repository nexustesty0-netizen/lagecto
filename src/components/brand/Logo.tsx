import { BRAND } from "@/lib/brand";

export function Logo({ size = 56 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/logo.png"
      alt={`${BRAND.name} logo`}
      width={size}
      height={size}
      className="rounded-2xl object-cover"
    />
  );
}
