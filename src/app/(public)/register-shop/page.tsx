import type { Metadata } from "next";
import { RegisterShopForm } from "@/components/public/RegisterShopForm";
import { FoundingUsersBanner } from "@/components/loyalty/FoundingUsersBanner";
import { selfServeShopPortal } from "@/lib/platform-flags.server";
import { PublicHero } from "@/components/public/PublicHero";
import { MARKETPLACE_IMAGES } from "@/lib/public-catalog";

export const metadata: Metadata = {
  title: "Register a shop",
  description: "Open a LaGecto shop in Bulawayo. You get a Shop ID, start on Free, and customers check out with you on WhatsApp.",
};

export default async function RegisterShopPage() {
  const portal = await selfServeShopPortal();
  const selfServe = portal.open;
  return (
    <article>
      <PublicHero
        kicker="Shops"
        title={selfServe ? "Create your shop" : "Register a shop"}
        subtitle={
          selfServe
            ? "Create your shop now. You get a Shop ID straight away and sign in with that ID."
            : "Self-serve shop creation is closed. Submit a request and LaGecto will review it, then activate your shop and give you a Shop ID."
        }
        image={MARKETPLACE_IMAGES.plansHero}
      />
      <div id="create-shop" className="mx-auto max-w-xl scroll-mt-24 px-4 py-10 sm:py-14">
        {selfServe ? <FoundingUsersBanner href="#create-shop" cta="Become a Founding User" force /> : null}
        <RegisterShopForm selfServe={selfServe} />
      </div>
    </article>
  );
}
