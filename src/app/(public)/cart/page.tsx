import type { Metadata } from "next";
import { CartClient } from "@/components/cart/CartClient";

export const metadata: Metadata = { title: "Cart" };

export default function PublicCartPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold">Your cart</h1>
      <p className="mt-2 text-sm text-[#6B7280]">
        Checkout via WhatsApp. You can place an order without an account if you add your name. LaGecto records it as
        pending, then WhatsApp opens so you can arrange payment directly with the shop.
      </p>
      <div className="mt-8">
        <CartClient />
      </div>
    </article>
  );
}
