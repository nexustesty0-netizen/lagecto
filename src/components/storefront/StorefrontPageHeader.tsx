import { HeroBackdrop } from "@/components/storefront/HeroBackdrop";

export function StorefrontPageHeader({
  kicker,
  title,
  subtitle,
  children,
  image,
  objectPosition = "center",
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  image?: string | null;
  objectPosition?: string;
}) {
  return (
    <section className="sf-hero-frame relative isolate min-h-[18rem] overflow-hidden sm:min-h-[22rem] lg:min-h-[26rem]" style={{ background: "var(--sf-primary, #0B6E4F)" }}>
      <HeroBackdrop url={image} objectPosition={objectPosition} />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, color-mix(in srgb, var(--sf-primary, #0B6E4F) 78%, transparent) 0%, color-mix(in srgb, var(--sf-primary, #0B6E4F) 48%, transparent) 55%, color-mix(in srgb, var(--sf-primary, #0B6E4F) 28%, transparent) 100%)",
        }}
      />
      <div className="relative z-[1] mx-auto flex min-h-[18rem] w-full max-w-6xl flex-col justify-center px-4 py-12 sm:min-h-[22rem] sm:py-16 lg:min-h-[26rem]">
        {kicker ? <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">{kicker}</p> : null}
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl text-white">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
            {subtitle ? <p className="mt-3 max-w-xl text-base leading-7 text-white/90">{subtitle}</p> : null}
          </div>
          {children ? <div className="text-white">{children}</div> : null}
        </div>
      </div>
    </section>
  );
}
