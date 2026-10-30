"use client";

import { useEffect } from "react";

export function TrackEvent(props: {
  eventType: "product_view" | "shop_view" | "add_to_cart" | "search" | "promotion_click" | "ad_click";
  shopId?: string | null;
  productId?: string | null;
  promotionId?: string | null;
  adId?: string | null;
  query?: string | null;
}) {
  useEffect(() => {
    const body = JSON.stringify({
      eventType: props.eventType,
      shopId: props.shopId || undefined,
      productId: props.productId || undefined,
      promotionId: props.promotionId || undefined,
      adId: props.adId || undefined,
      query: props.query || undefined,
    });
    fetch("/api/marketplace/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  }, [props.eventType, props.shopId, props.productId, props.promotionId, props.adId, props.query]);
  return null;
}
