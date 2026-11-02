"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/useCart";
import { useState } from "react";

export function AddToCartButton({
  product,
  label = "Add to cart",
  size = "compact",
}: {
  product: {
    productId: string;
    shopId: string;
    shopName: string;
    name: string;
    price: number;
    image?: string | null;
    type?: "product" | "service";
    availability?: "available" | "on_order" | null;
    stock?: number | null;
    quantity?: number;
  };
  label?: string;
  size?: "compact" | "default";
}) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  const compact = size === "compact";
  const soldOut =
    product.type !== "service" &&
    product.availability !== "on_order" &&
    product.stock != null &&
    Number(product.stock) <= 0;
  return (
    <div className="relative">
      <button
        type="button"
        disabled={soldOut}
        onClick={() => {
          if (soldOut) return;
          add({ ...product, quantity: product.quantity || 1 });
          setAdded(true);
          window.setTimeout(() => setAdded(false), 1400);
          fetch("/api/marketplace/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventType: "add_to_cart", shopId: product.shopId, productId: product.productId }),
            keepalive: true,
          }).catch(() => undefined);
        }}
        className={
          compact
            ? "flex h-11 w-full items-center justify-center rounded-full bg-[var(--lagecto-primary)] px-1.5 text-[10px] font-semibold leading-none text-white disabled:opacity-50 sm:px-4 sm:text-sm [.storefront-root_&]:bg-[var(--sf-button)] [.storefront-root_&]:text-[var(--sf-button-text)]"
            : "lg-btn w-full [.storefront-root_&]:bg-[var(--sf-button)] [.storefront-root_&]:text-[var(--sf-button-text)]"
        }
      >
        {soldOut ? (
          compact ? (
            <>
              <span className="sm:hidden">Out</span>
              <span className="hidden sm:inline">Out of stock</span>
            </>
          ) : (
            "Out of stock"
          )
        ) : added ? (
          "Added"
        ) : compact ? (
          <>
            <span className="sm:hidden">Add</span>
            <span className="hidden sm:inline">{label}</span>
          </>
        ) : (
          label
        )}
      </button>
      {added ? (
        <Link
          href="/cart"
          className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-[2] text-center text-[10px] font-semibold leading-none text-[#0B6E4F] sm:text-sm [.storefront-root_&]:text-[var(--sf-primary)]"
        >
          Go to cart
        </Link>
      ) : null}
    </div>
  );
}
