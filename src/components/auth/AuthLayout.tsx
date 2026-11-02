import Link from "next/link";
import { Headphones } from "lucide-react";
import { AuthMark } from "@/components/auth/AuthMark";
import { HeroSlideshow } from "@/components/public/HeroSlideshow";

function WelcomeCopy({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "max-w-lg" : "max-w-lg pb-4"}>
      <p className="text-xs font-semibold tracking-[0.22em] text-[#FFB000] uppercase">Bulawayo</p>
      <h2 className={`mt-2 font-semibold text-white ${compact ? "text-[1.55rem] leading-tight" : "text-[2.1rem] leading-[1.12] lg:text-[2.7rem]"}`}>
        Wamkelekile kuLaGecto.
        <br />
        <span className="text-[#FFB000]">Mauya kuLaGecto.</span>
      </h2>
      <p className={`font-medium text-white/95 ${compact ? "mt-2 text-sm" : "mt-3 text-[15px]"}`}>
        Khula Nathi, Mhlobo. Kura Nesu Sahwira
      </p>
      <p className={`max-w-md leading-6 text-white/88 ${compact ? "mt-2 text-sm" : "mt-3 text-[15px] leading-7"}`}>
        Discover local shops, shop with ease, support businesses and grow together.
      </p>
    </div>
  );
}

function BrandPanel() {
  return (
    <aside className="relative hidden min-h-dvh overflow-hidden md:flex md:w-[48%] md:flex-col lg:w-[55%]">
      <HeroSlideshow showDots={false} overlayClass="" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0B6E4F] via-[#0B6E4F]/55 to-[#0B6E4F]/20" />
      <div className="relative z-[1] mt-auto px-8 py-10 lg:px-12 lg:py-12">
        <AuthMark tone="dark" />
        <div className="mt-6">
          <WelcomeCopy />
        </div>
      </div>
    </aside>
  );
}

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lg-auth min-h-dvh md:flex">
      <BrandPanel />
      <main className="relative flex min-h-dvh flex-1 flex-col bg-[#0B6E4F] pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white md:bg-[#F3EEE0] md:px-10 md:pt-8 md:pb-10 md:text-[#151515]">
        <section className="relative overflow-hidden md:hidden">
          <div className="relative min-h-[42vh]">
            <HeroSlideshow showDots={false} overlayClass="" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B6E4F] via-[#0B6E4F]/50 to-[#0B6E4F]/18" />
            <div className="relative z-[1] px-5 pb-6 pt-[max(1rem,env(safe-area-inset-top))]">
              <div className="flex items-center justify-between">
                <AuthMark tone="dark" size="sm" />
                <Link href="/support" className="auth-help">
                  Need help?
                  <Headphones size={14} />
                </Link>
              </div>
              <div className="mt-8">
                <WelcomeCopy compact />
              </div>
            </div>
          </div>
        </section>

        <div className="hidden md:block">
          <Link href="/support" className="auth-help md:absolute md:top-5 md:right-8">
            Need help?
            <Headphones size={14} />
          </Link>
        </div>
        <Link href="/marketplace" className="auth-back mx-5 mt-4 w-fit md:absolute md:top-5 md:left-8 md:mx-0 md:mt-0">
          Back to marketplace
        </Link>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center px-5 py-5 md:max-w-[440px] md:px-0 md:py-0">
          <div className="auth-card">{children}</div>
        </div>
      </main>
    </div>
  );
}
