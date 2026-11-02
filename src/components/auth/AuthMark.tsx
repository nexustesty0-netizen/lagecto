import { BRAND } from "@/lib/brand";

export function AuthMark({
  tone = "light",
  size = "md",
}: {
  tone?: "light" | "dark";
  size?: "sm" | "md";
}) {
  const onDark = tone === "dark";
  const mark = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  return (
    <div className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo.png"
        alt=""
        className={`${mark} rounded-lg bg-white object-contain p-0.5`}
      />
      <div className="leading-tight">
        <p className={`font-semibold tracking-tight ${size === "sm" ? "text-lg" : "text-xl"} ${onDark ? "text-white" : "text-[#151515]"}`}>
          {BRAND.name}
        </p>
        <p className={`text-[11px] ${onDark ? "text-white/70" : "text-[#737373]"}`}>Shop. Support. Grow.</p>
      </div>
    </div>
  );
}
