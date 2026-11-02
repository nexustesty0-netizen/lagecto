"use client";

import { useState } from "react";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { MessageShopButton } from "@/components/chat/MessageShopButton";
import { capCartQuantity } from "@/lib/cart-math";

export function CatalogBuyBox({
  product,
  enquire,
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
  };
  enquire: {
    loggedIn: boolean;
    nextPath: string;
    show?: boolean;
  };
}) {
  const isService = product.type === "service";
  const maxQty = capCartQuantity(99, product.stock, product.type, product.availability) || 1;
  const [qty, setQty] = useState(1);
  const quantity = Math.min(Math.max(1, qty), maxQty);

  return (
    <div className="mt-6 grid gap-3">
      {isService ? null : (
        <label className="flex items-center justify-between gap-3 text-sm font-medium">
          Quantity
          <span className="inline-flex items-center rounded-full border border-black/10">
            <button
              type="button"
              className="grid h-11 w-11 place-items-center"
              onClick={() => setQty((value) => Math.max(1, value - 1))}
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="min-w-8 text-center">{quantity}</span>
            <button
              type="button"
              className="grid h-11 w-11 place-items-center"
              onClick={() => setQty((value) => Math.min(maxQty, value + 1))}
              aria-label="Increase quantity"
            >
              +
            </button>
          </span>
        </label>
      )}
      <AddToCartButton
        size="default"
        label={isService ? "Add to cart" : "Add to cart"}
        product={{ ...product, quantity }}
      />
      {enquire.show === false ? null : (
        <MessageShopButton
          shopId={product.shopId}
          shopName={product.shopName}
          productId={product.productId}
          productName={product.name}
          loggedIn={enquire.loggedIn}
          nextPath={enquire.nextPath}
        />
      )}
    </div>
  );
}
