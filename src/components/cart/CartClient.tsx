"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/cart/useCart";
import { money } from "@/lib/format";
import { EmptyState } from "@/components/ui/primitives";
import { productHref, shopHref } from "@/lib/storefront/paths";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { availabilityLabel, isOnOrder } from "@/lib/product-availability";
import { MessageShopButton } from "@/components/chat/MessageShopButton";
import { pricesDiffer } from "@/lib/cart-math";
import { productImage } from "@/lib/placeholder-cover";
import type { CartItem } from "@/lib/types";

type QuoteLine = {
  product_id: string;
  name: string;
  image?: string | null;
  quantity: number;
  list_price: number;
  unit_price: number;
  line_total: number;
  availability?: string;
  stock?: number | null;
  max_qty?: number;
  status?: string;
  low_stock?: boolean;
  alternatives?: { id: string; name: string; image?: string | null; price: number }[];
};

type Quote = {
  shop_id: string;
  items: QuoteLine[];
  subtotal: number;
  discount: number;
  promo_discount?: number;
  promo_code?: string | null;
  promo_name?: string | null;
  total: number;
  can_checkout?: boolean;
};

type ShopContact = { name: string; whatsapp?: string | null; phone?: string | null; shopId?: string };

function lineStatus(item: CartItem, quoted?: QuoteLine) {
  if (!quoted) return "checking";
  return quoted.status || "ok";
}

export function CartClient() {
  const { items, update, remove, clear, removeShop } = useCart();
  const pathname = usePathname();
  const loginHref = `/login?next=${encodeURIComponent(pathname || "/cart")}`;
  const [message, setMessage] = useState("");
  const [loadingShop, setLoadingShop] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [quoteError, setQuoteError] = useState<Record<string, string>>({});
  const [contacts, setContacts] = useState<Record<string, ShopContact>>({});
  const [contactsReady, setContactsReady] = useState(false);
  const [promoDraft, setPromoDraft] = useState<Record<string, string>>({});
  const [promoApplied, setPromoApplied] = useState<Record<string, string>>({});
  const [promoMessage, setPromoMessage] = useState<Record<string, string>>({});
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  const groups = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const item of items) {
      const list = map.get(item.shopId) || [];
      list.push(item);
      map.set(item.shopId, list);
    }
    return [...map.entries()];
  }, [items]);

  useEffect(() => {
    try {
      createBrowserSupabase()
        .auth.getUser()
        .then(({ data }) => setSignedIn(Boolean(data.user)))
        .catch(() => setSignedIn(false));
    } catch {
      setSignedIn(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const nextQuotes: Record<string, Quote> = {};
      const nextContacts: Record<string, ShopContact> = {};
      const nextErrors: Record<string, string> = {};
      for (const [shopId, shopItems] of groups) {
        const [quoteRes, contactRes] = await Promise.all([
          fetch("/api/cart/quote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              shopId,
              items: shopItems.map((item) => ({ productId: item.productId, quantity: item.quantity })),
              promoCode: promoApplied[shopId] || undefined,
            }),
          }),
          fetch(`/api/shops/${shopId}/contact`),
        ]);
        const quoteData = await quoteRes.json().catch(() => ({}));
        if (quoteRes.ok && quoteData.ok) nextQuotes[shopId] = quoteData;
        else {
          nextErrors[shopId] = quoteData.error || "Unable to price these items.";
          if (promoApplied[shopId] && !cancelled) {
            const err = String(quoteData.error || "");
            const promoFailed = /promo|code|eligib|expired|limit|loyalty|minimum|sign in/i.test(err);
            if (promoFailed) {
              setPromoApplied((current) => {
                const next = { ...current };
                delete next[shopId];
                return next;
              });
              setPromoMessage((current) => ({ ...current, [shopId]: quoteData.error || "Promo code is invalid." }));
            }
          }
        }
        if (contactRes.ok) nextContacts[shopId] = await contactRes.json();
      }
      if (!cancelled) {
        setQuotes(nextQuotes);
        setQuoteError(nextErrors);
        setContacts(nextContacts);
        setContactsReady(true);
        setPromoMessage((current) => {
          const next = { ...current };
          for (const shopId of Object.keys(nextQuotes)) {
            const quoted = nextQuotes[shopId];
            if (quoted.promo_code) next[shopId] = `Promo applied${quoted.promo_discount ? ` · you save ${money(quoted.promo_discount)}` : ""}.`;
          }
          return next;
        });
      }
    }
    if (groups.length) void load();
    else {
      setQuotes({});
      setContactsReady(true);
    }
    return () => {
      cancelled = true;
    };
  }, [groups, promoApplied]);

  function shopTotal(shopId: string, shopItems: typeof items) {
    const quote = quotes[shopId];
    return quote?.total ?? shopItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  const spending = useMemo(() => {
    return groups.map(([shopId, shopItems]) => ({
      shopId,
      shopName: shopItems[0]?.shopName || contacts[shopId]?.name || "Shop",
      count: shopItems.reduce((sum, item) => sum + item.quantity, 0),
      total: shopTotal(shopId, shopItems),
    }));
  }, [groups, quotes, contacts]);

  const grandTotal = spending.reduce((sum, row) => sum + row.total, 0);

  function openWhatsApp(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function checkout(shopId: string) {
    const shopItems = items.filter((item) => item.shopId === shopId);
    if (!shopItems.length) return;
    if (quotes[shopId] && quotes[shopId].can_checkout === false) {
      setMessage("Remove unavailable items or reduce quantities before placing this order.");
      return;
    }
    if (!signedIn && guestName.trim().length < 2) {
      setMessage("Add your name so the shop knows who placed this order.");
      return;
    }
    setMessage("");
    setLoadingShop(shopId);

    const res = await fetch("/api/orders/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopId,
        items: shopItems.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        promoCode: signedIn ? promoApplied[shopId] || undefined : undefined,
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
      }),
    });
    const data = await res.json();
    setLoadingShop(null);
    if (!res.ok) {
      setMessage(data.error || "Checkout failed.");
      return;
    }
    removeShop(shopId);
    if (data.whatsapp_url) {
      setMessage(`Order ${data.order_number} is pending. Continue on WhatsApp to arrange payment with the shop.`);
      openWhatsApp(String(data.whatsapp_url));
      return;
    }
    setMessage(
      `Order ${data.order_number} is pending. This shop has not added a WhatsApp number yet, so payment cannot be opened automatically.`,
    );
  }

  if (!items.length) {
    return (
      <div className="grid gap-4">
        <EmptyState
          title="Your cart is empty"
          body="Browse shops and add products. Checkout is via WhatsApp — you can order without an account if you add your name."
          action={
            <Link href="/marketplace" className="inline-flex rounded-full bg-[#0B6E4F] px-4 py-2 text-sm font-semibold text-white">
              Browse marketplace
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="lg-card p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--lagecto-muted)]">Spending summary</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <p className="text-sm">
            <span className="block text-[var(--lagecto-muted)]">Shops</span>
            <span className="font-semibold">{groups.length}</span>
          </p>
          <p className="text-sm">
            <span className="block text-[var(--lagecto-muted)]">Items</span>
            <span className="font-semibold">{items.reduce((sum, item) => sum + item.quantity, 0)}</span>
          </p>
          <p className="text-sm">
            <span className="block text-[var(--lagecto-muted)]">Estimated total</span>
            <span className="font-semibold">{money(grandTotal)}</span>
          </p>
        </div>
        <ul className="mt-4 grid gap-1 text-sm">
          {spending.map((row) => (
            <li key={row.shopId} className="flex items-center justify-between gap-3">
              <span className="truncate">{row.shopName}</span>
              <span className="shrink-0 text-[var(--lagecto-muted)]">
                {row.count} · {money(row.total)}
              </span>
            </li>
          ))}
        </ul>
        {groups.length > 1 ? (
          <p className="mt-3 text-xs leading-5 text-[var(--lagecto-muted)]">Items from different shops stay separate.</p>
        ) : null}
      </section>
      {!signedIn ? (
        <div className="lg-card grid gap-3 p-4">
          <p className="font-semibold">Order without an account</p>
          <p className="text-sm text-[#6B7280]">
            Add your name so the shop can identify the order.
          </p>
          <label className="grid gap-1 text-sm">
            Your name or business name
            <input
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
              required
              minLength={2}
              className="rounded-xl border px-3 py-2"
              placeholder="Name shown to the shop"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Phone (optional)
            <input
              value={guestPhone}
              onChange={(event) => setGuestPhone(event.target.value)}
              className="rounded-xl border px-3 py-2"
              placeholder="So the shop can reach you"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <Link href={loginHref} className="text-sm font-semibold text-[#0B6E4F]">
              Sign in instead
            </Link>
            <Link href="/signup" className="text-sm font-semibold text-[#0B6E4F]">
              Create account
            </Link>
          </div>
        </div>
      ) : null}
      {groups.map(([shopId, shopItems]) => {
        const quote = quotes[shopId];
        const shopName = shopItems[0]?.shopName || contacts[shopId]?.name || "this shop";
        const busy = loadingShop === shopId;
        const hasWhatsApp = Boolean(contacts[shopId]?.whatsapp || contacts[shopId]?.phone);
        const blocked = quote ? quote.can_checkout === false : Boolean(quoteError[shopId]);
        return (
          <section key={shopId} className="lg-card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold">{shopName}</h2>
                <p className="text-xs text-[var(--lagecto-muted)]">
                  {shopItems.length} product{shopItems.length === 1 ? "" : "s"} · {shopItems.reduce((sum, item) => sum + item.quantity, 0)} items
                </p>
              </div>
              <Link href={shopHref({ id: shopId })} className="text-sm text-[#0B6E4F]">
                Continue shopping
              </Link>
            </div>
            {quoteError[shopId] ? <p className="mb-3 text-sm text-[#C2413B]">{quoteError[shopId]}</p> : null}
            <div className="grid gap-3">
              {shopItems.map((item) => {
                const quoted = quote?.items.find((row) => row.product_id === item.productId);
                const unit = quoted?.unit_price ?? item.price;
                const list = quoted?.list_price ?? item.price;
                const status = lineStatus(item, quoted);
                const maxQty = quoted?.max_qty ?? 99;
                const changed = quoted ? pricesDiffer(item.price, unit) : false;
                return (
                  <article key={item.productId} className="flex gap-3 rounded-xl border border-[var(--lagecto-border)] bg-white p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={productImage(quoted?.image || item.image)}
                      alt=""
                      className="h-20 w-20 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{quoted?.name || item.name}</p>
                      <p className="text-xs text-[var(--lagecto-muted)]">
                        {isOnOrder(quoted?.availability || item.availability)
                          ? availabilityLabel(quoted?.availability || item.availability)
                          : status === "unavailable"
                            ? "No longer available"
                            : quoted?.stock != null
                              ? `${quoted.stock} in stock`
                              : "Live price from the shop"}
                      </p>
                      <p className="mt-1 text-sm">
                        {money(unit)}
                        {list > unit ? <span className="ml-2 text-[var(--lagecto-muted)] line-through">{money(list)}</span> : null}
                      </p>
                      {changed ? (
                        <p className="mt-1 text-xs text-[#9A6B12]">Price updated from {money(item.price)} to {money(unit)}.</p>
                      ) : null}
                      {quoted?.low_stock ? <p className="mt-1 text-xs text-[#9A6B12]">Low stock — only a few left.</p> : null}
                      {status === "insufficient_stock" ? (
                        <p className="mt-1 text-xs text-[#C2413B]">
                          Not enough stock{quoted?.max_qty != null ? ` · ${quoted.max_qty} available` : ""}. Reduce the quantity to continue.
                        </p>
                      ) : null}
                      {status === "unavailable" ? (
                        <p className="mt-1 text-xs text-[#C2413B]">This product cannot be ordered. Remove it or choose a similar item from this shop.</p>
                      ) : null}
                      {quoted?.alternatives?.length ? (
                        <div className="mt-2 grid gap-1">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--lagecto-muted)]">Similar from this shop</p>
                          {quoted.alternatives.map((alt) => (
                            <Link key={alt.id} href={productHref({ id: shopId }, alt.id)} className="text-sm text-[#0B6E4F]">
                              {alt.name} · {money(alt.price)}
                            </Link>
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center rounded-full border border-[var(--lagecto-border)]">
                          <button
                            type="button"
                            className="grid h-10 w-10 place-items-center"
                            onClick={() => update(item.productId, item.quantity - 1, { stock: quoted?.stock, type: item.type, availability: item.availability })}
                            aria-label={`Reduce ${item.name}`}
                          >
                            −
                          </button>
                          <span className="min-w-8 text-center text-sm">{item.quantity}</span>
                          <button
                            type="button"
                            className="grid h-10 w-10 place-items-center disabled:opacity-40"
                            disabled={item.quantity >= maxQty}
                            onClick={() => update(item.productId, item.quantity + 1, { stock: quoted?.max_qty ?? quoted?.stock, type: item.type, availability: item.availability })}
                            aria-label={`Increase ${item.name}`}
                          >
                            +
                          </button>
                        </div>
                        <button type="button" className="min-h-10 px-2 text-sm text-[#C2413B]" onClick={() => remove(item.productId)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="mt-4 text-right text-sm">
              <p>Shop subtotal {money(quote?.subtotal ?? shopItems.reduce((sum, item) => sum + item.price * item.quantity, 0))}</p>
              {quote?.discount ? <p>Discounts {money(quote.discount)}</p> : null}
              {quote?.promo_code ? (
                <p className="text-[#0B6E4F]">
                  Promo {quote.promo_code} applied
                  {quote.promo_discount ? ` · saved ${money(quote.promo_discount)}` : ""}
                </p>
              ) : null}
              <p className="text-lg font-semibold">Shop total {money(shopTotal(shopId, shopItems))}</p>
            </div>
            {signedIn ? (
              <div className="mt-4 rounded-xl bg-[#F7F3E3] p-4 text-left">
                <label className="text-sm font-semibold" htmlFor={`promo-${shopId}`}>
                  Have a promo code?
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    id={`promo-${shopId}`}
                    value={promoDraft[shopId] || ""}
                    onChange={(e) => setPromoDraft((current) => ({ ...current, [shopId]: e.target.value }))}
                    placeholder="Enter promo code"
                    className="min-w-0 flex-1 rounded-xl border px-3 py-2 uppercase"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="min-h-11 rounded-xl bg-[#0B6E4F] px-4 py-2 text-sm font-semibold text-white"
                    onClick={() => {
                      const code = (promoDraft[shopId] || "").trim();
                      if (!code) {
                        setPromoApplied((current) => {
                          const next = { ...current };
                          delete next[shopId];
                          return next;
                        });
                        setPromoMessage((current) => ({ ...current, [shopId]: "" }));
                        return;
                      }
                      setPromoApplied((current) => ({ ...current, [shopId]: code }));
                      setPromoMessage((current) => ({ ...current, [shopId]: "Checking code…" }));
                    }}
                  >
                    Apply
                  </button>
                </div>
                {promoMessage[shopId] ? (
                  <p className={`mt-2 text-sm ${quote?.promo_code ? "text-[#0B6E4F]" : "text-[#C2413B]"}`}>{promoMessage[shopId]}</p>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[#6B7280]">Sign in to apply a promo code. You can still place this order with your name.</p>
            )}
            {contactsReady && !hasWhatsApp ? (
              <p className="mt-4 text-sm text-[#C2413B]">
                {shopName} has not added a WhatsApp number yet. You can still place the order; contact the shop from its page to arrange payment.
              </p>
            ) : null}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={busy || blocked}
                onClick={() => void checkout(shopId)}
                className="min-h-12 rounded-xl bg-[#25D366] px-4 py-3 font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Placing order…" : blocked ? "Fix items to order" : "Place order & open WhatsApp"}
              </button>
              {signedIn ? (
                <MessageShopButton shopId={shopId} shopName={shopName} loggedIn nextPath={pathname || "/cart"} />
              ) : (
                <Link href={loginHref} className="grid min-h-12 place-items-center rounded-xl border border-[var(--lagecto-border)] px-4 text-sm font-semibold">
                  Sign in to message {shopName}
                </Link>
              )}
            </div>
          </section>
        );
      })}
      <button
        type="button"
        onClick={() => {
          if (window.confirm("Remove every item from your cart?")) clear();
        }}
        className="text-sm text-[#C2413B]"
      >
        Clear cart
      </button>
      {message ? <p className="text-sm text-[#0B6E4F]">{message}</p> : null}
    </div>
  );
}
