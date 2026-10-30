"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { CartItem } from "@/lib/types";

const KEY = "lagecto-cart";
const EMPTY: CartItem[] = [];
const listeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cachedItems: CartItem[] = EMPTY;

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

export function useCart() {
  const items = useSyncExternalStore(subscribe, readCart, () => EMPTY);

  const persist = useCallback((next: CartItem[]) => {
    const raw = JSON.stringify(next);
    localStorage.setItem(KEY, raw);
    cachedRaw = raw;
    cachedItems = next;
    emit();
  }, []);

  const add = useCallback(
    (item: Omit<CartItem, "quantity"> & { quantity?: number }) => {
      const current = readCart();
      const existing = current.find((row) => row.productId === item.productId);
      if (existing) {
        persist(
          current.map((row) =>
            row.productId === item.productId
              ? { ...row, quantity: row.quantity + (item.quantity || 1) }
              : row,
          ),
        );
        return;
      }
      persist([...current, { ...item, quantity: item.quantity || 1 }]);
    },
    [persist],
  );

  const update = useCallback(
    (productId: string, quantity: number) => {
      const current = readCart();
      persist(
        quantity <= 0
          ? current.filter((row) => row.productId !== productId)
          : current.map((row) => (row.productId === productId ? { ...row, quantity } : row)),
      );
    },
    [persist],
  );

  const removeShop = useCallback(
    (shopId: string) => {
      persist(readCart().filter((row) => row.shopId !== shopId));
    },
    [persist],
  );

  const clear = useCallback(() => persist(EMPTY), [persist]);

  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return { items, add, update, clear, removeShop, count, total };
}
