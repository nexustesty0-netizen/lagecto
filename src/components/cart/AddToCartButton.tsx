"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/useCart";
import { useState } from "react";

export function AddToCartButton({
  product,
}: {
  product: {
    productId: string;
    shopId: string;
    shopName: string;
    name: string;
    price: number;
    image?: string | null;
    type?: "product" | "service";
  };
}) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  return (
    <div className="mt-2 grid gap-2 sm:mt-3">
      <button
        type="button"
        onClick={() => {
          add(product);
          setAdded(true);
          window.setTimeout(() => setAdded(false), 1400);
          fetch("/api/marketplace/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventType: "add_to_cart", shopId: product.shopId, productId: product.productId }),
            keepalive: true,
          }).catch(() => undefined);
        }}
        className="min-h-11 w-full rounded-full bg-[#0B6E4F] px-3 py-2 text-xs font-semibold text-white sm:px-4 sm:text-sm [.storefront-root_&]:bg-[var(--sf-button)] [.storefront-root_&]:text-[var(--sf-button-text)]"
      >
        {added ? "Added" : "Add to cart"}
      </button>
      {added ? (
        <Link href="/cart" className="text-center text-sm font-semibold text-[#0B6E4F] [.storefront-root_&]:text-[var(--sf-primary)]">
          Go to cart
        </Link>
      ) : null}
    </div>
  );
}
