import { HeroBackdrop } from "@/components/storefront/HeroBackdrop";

export function TechHero({
  image,
  kicker,
  title,
  subtitle,
  actions,
  objectPosition = "center",
}: {
  image: string;
  kicker?: string;
  title: string;
  subtitle?: string;
  actions?: { href: string; label: string; primary?: boolean }[];
  objectPosition?: string;
}) {
  return (
    <section className="sf-hero-frame relative isolate min-h-[20rem] overflow-hidden sm:min-h-[26rem] lg:min-h-[32rem]" style={{ background: "var(--sf-primary)" }}>
      <HeroBackdrop url={image} objectPosition={objectPosition} />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, color-mix(in srgb, var(--sf-primary) 78%, transparent) 0%, color-mix(in srgb, var(--sf-primary) 48%, transparent) 55%, color-mix(in srgb, var(--sf-primary) 28%, transparent) 100%)",
        }}
      />
      <div className="relative z-[1] mx-auto flex min-h-[20rem] max-w-6xl flex-col justify-center px-4 py-14 sm:min-h-[26rem] sm:py-20 lg:min-h-[32rem] lg:py-24">
        <div className="max-w-2xl text-white">
          {kicker ? <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">{kicker}</p> : null}
          <h1 className="mt-3 text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl">{title}</h1>
          {subtitle ? <p className="mt-4 max-w-xl text-sm leading-7 text-white/92 sm:text-base">{subtitle}</p> : null}
          {actions?.length ? (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {actions.map((action) => (
                <a
                  key={action.href}
                  href={action.href}
                  className={
                    action.primary
                      ? "inline-flex min-h-12 items-center justify-center bg-white px-6 text-sm font-semibold"
                      : "inline-flex min-h-12 items-center justify-center border border-white/50 px-6 text-sm font-semibold text-white"
                  }
                  style={action.primary ? { color: "var(--sf-primary)" } : undefined}
                >
                  {action.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
