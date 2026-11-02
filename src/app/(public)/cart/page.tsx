import type { Metadata } from "next";
import { CartClient } from "@/components/cart/CartClient";

export const metadata: Metadata = { title: "Cart", robots: { index: false, follow: false } };

export default function PublicCartPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold">Your cart</h1>
      <div className="mt-8">
        <CartClient />
      </div>
    </article>
  );
}
