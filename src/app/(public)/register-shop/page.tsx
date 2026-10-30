import type { Metadata } from "next";
import { RegisterShopForm } from "@/components/public/RegisterShopForm";
import { FoundingUsersBanner } from "@/components/loyalty/FoundingUsersBanner";
import { selfServeShopCreationEnabled } from "@/lib/platform-flags.server";

export const metadata: Metadata = { title: "Register a shop" };

export default async function RegisterShopPage() {
  const selfServe = await selfServeShopCreationEnabled();
  return (
    <article className="mx-auto max-w-xl px-4 py-16">
      <FoundingUsersBanner href="/register-shop" />
      <h1 className="text-3xl font-semibold sm:text-4xl">{selfServe ? "Create your shop" : "Register a shop"}</h1>
      <p className="mt-3 text-[#6B7280]">
        {selfServe
          ? "Create your shop now. You get a Shop ID straight away and sign in with that ID. You start on the unpaid Free plan — for now every shop tool is included."
          : "Submit a shop request. LaGecto reviews it, then activates the shop and gives you a Shop ID to sign in."}
      </p>
      <RegisterShopForm selfServe={selfServe} />
    </article>
  );
}
