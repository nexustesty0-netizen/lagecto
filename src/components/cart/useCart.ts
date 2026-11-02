"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { CartItem } from "@/lib/types";
import { capCartQuantity, mergeCartItems, normalizeCartQty } from "@/lib/cart-math";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const KEY = "lagecto-cart";
const EMPTY: CartItem[] = [];
const listeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cachedItems: CartItem[] = EMPTY;
let signedInCart = false;
let saveTimer: number | null = null;
let hydratePromise: Promise<void> | null = null;

function readCart(): CartItem[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY) || "[]";
    if (raw === cachedRaw) return cachedItems;
    const parsed = JSON.parse(raw);
    cachedRaw = raw;
    cachedItems = Array.isArray(parsed) ? parsed : EMPTY;
    return cachedItems;
  } catch {
    cachedRaw = "[]";
    cachedItems = EMPTY;
    return EMPTY;
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function persist(next: CartItem[], syncRemote = true) {
  const raw = JSON.stringify(next);
  localStorage.setItem(KEY, raw);
  cachedRaw = raw;
  cachedItems = next;
  emit();
  if (!syncRemote || !signedInCart) return;
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    void fetch("/api/cart", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: next.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, 400);
}

function mapRemote(rows: unknown): CartItem[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const item = row as CartItem;
    return {
      productId: item.productId,
      shopId: item.shopId,
      shopName: item.shopName,
      name: item.name,
      price: Number(item.price) || 0,
      quantity: normalizeCartQty(item.quantity),
      image: item.image,
      type: item.type,
      availability: item.availability,
    };
  });
}

async function hydrateCart() {
  try {
    const res = await fetch("/api/cart");
    if (res.status === 401 || res.status === 403) {
      signedInCart = false;
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    signedInCart = true;
    const merged = mergeCartItems(readCart(), mapRemote(data.items));
    persist(merged, true);
  } catch {
    /* keep the device cart */
  }
}

function ensureHydrated() {
  if (!hydratePromise) hydratePromise = hydrateCart();
  return hydratePromise;
}

export function useCart() {
  const items = useSyncExternalStore(subscribe, readCart, () => EMPTY);

  useEffect(() => {
    void ensureHydrated();
    let unsubscribe: (() => void) | undefined;
    try {
      const { data } = createBrowserSupabase().auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN") {
          hydratePromise = null;
          void ensureHydrated();
        }
        if (event === "SIGNED_OUT") signedInCart = false;
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch {
      /* public pages without supabase config still keep the device cart */
    }
    return () => unsubscribe?.();
  }, []);

  const add = useCallback((item: Omit<CartItem, "quantity"> & { quantity?: number; stock?: number | null }) => {
    const current = readCart();
    const quantity = capCartQuantity(
      item.quantity || 1,
      item.stock,
      item.type,
      item.availability,
    );
    if (!quantity) return;
    const existing = current.find((row) => row.productId === item.productId);
    if (existing) {
      persist(
        current.map((row) =>
          row.productId === item.productId
            ? {
                ...row,
                ...item,
                quantity: capCartQuantity(row.quantity + quantity, item.stock, item.type, item.availability) || row.quantity,
              }
            : row,
        ),
      );
      return;
    }
    persist([...current, { ...item, quantity }]);
  }, []);

  const update = useCallback((productId: string, quantity: number, limits?: { stock?: number | null; type?: CartItem["type"]; availability?: CartItem["availability"] }) => {
    const current = readCart();
    const nextQty = capCartQuantity(quantity, limits?.stock, limits?.type, limits?.availability);
    persist(
      nextQty <= 0
        ? current.filter((row) => row.productId !== productId)
        : current.map((row) => (row.productId === productId ? { ...row, quantity: nextQty } : row)),
    );
  }, []);

  const remove = useCallback((productId: string) => {
    persist(readCart().filter((row) => row.productId !== productId));
  }, []);

  const removeShop = useCallback((shopId: string) => {
    persist(readCart().filter((row) => row.shopId !== shopId));
  }, []);

  const clear = useCallback(() => persist(EMPTY), []);

  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return { items, add, update, remove, clear, removeShop, count, total };
}
