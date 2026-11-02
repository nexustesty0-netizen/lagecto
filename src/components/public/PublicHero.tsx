import { HeroSlideshow } from "@/components/public/HeroSlideshow";

export function PublicHero({
  kicker,
  title,
  subtitle,
  image,
  slideshow = false,
  children,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  image?: string;
  slideshow?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section className="sf-hero-frame relative isolate min-h-[20rem] overflow-hidden sm:min-h-[26rem] lg:min-h-[32rem]">
      {slideshow ? (
        <HeroSlideshow overlayClass="" />
      ) : image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-[#0B6E4F]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0B6E4F]/82 via-[#0B6E4F]/55 to-[#0B6E4F]/32" />
      <div className="relative z-[2] mx-auto flex min-h-[20rem] w-full max-w-6xl flex-col justify-center px-4 py-14 sm:min-h-[26rem] sm:px-8 sm:py-20 lg:min-h-[32rem] lg:py-24">
        {kicker ? <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">{kicker}</p> : null}
        <h1 className="mt-2 max-w-2xl text-[1.7rem] font-semibold leading-[1.15] tracking-tight text-white sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        {subtitle ? <p className="mt-3 max-w-xl text-sm text-white/90 sm:text-base">{subtitle}</p> : null}
        {children ? <div className="mt-6">{children}</div> : null}
      </div>
    </section>
  );
}
