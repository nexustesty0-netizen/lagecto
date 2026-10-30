"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/cart/useCart";
import { money } from "@/lib/format";
import { EmptyState } from "@/components/ui/primitives";
import { shopHref } from "@/lib/storefront/paths";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Quote = {
  shop_id: string;
  items: { product_id: string; name: string; quantity: number; list_price: number; unit_price: number; line_total: number }[];
  subtotal: number;
  discount: number;
  promo_discount?: number;
  promo_code?: string | null;
  promo_name?: string | null;
  total: number;
};

type ShopContact = { name: string; whatsapp?: string | null; phone?: string | null };

export function CartClient() {
  const { items, update, clear, removeShop } = useCart();
  const pathname = usePathname();
  const loginHref = `/login?next=${encodeURIComponent(pathname || "/cart")}`;
  const [message, setMessage] = useState("");
  const [loadingShop, setLoadingShop] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
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
    createBrowserSupabase()
      .auth.getUser()
      .then(({ data }) => setSignedIn(Boolean(data.user)))
      .catch(() => setSignedIn(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const nextQuotes: Record<string, Quote> = {};
      const nextContacts: Record<string, ShopContact> = {};
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
        const quoteData = await quoteRes.json();
        if (quoteRes.ok && quoteData.ok) nextQuotes[shopId] = quoteData;
        else if (promoApplied[shopId] && !cancelled) {
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
        if (contactRes.ok) nextContacts[shopId] = await contactRes.json();
      }
      if (!cancelled) {
        setQuotes(nextQuotes);
        setContacts(nextContacts);
        setContactsReady(true);
        setPromoMessage((current) => {
          const next = { ...current };
          for (const shopId of Object.keys(nextQuotes)) {
            const quoted = nextQuotes[shopId];
            if (quoted.promo_code) next[shopId] = `Promo applied${quoted.promo_discount ? ` · you save ${quoted.promo_discount}` : ""}.`;
          }
          return next;
        });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [groups, promoApplied]);

  function shopTotal(shopId: string, shopItems: typeof items) {
    const quote = quotes[shopId];
    return quote?.total ?? shopItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  function openWhatsApp(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function checkout(shopId: string) {
    const shopItems = items.filter((item) => item.shopId === shopId);
    if (!shopItems.length) return;
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
        />
        <Link href="/marketplace" className="text-center font-semibold text-[#0B6E4F]">
          Browse marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="lg-card p-4">
        <p className="font-semibold">Checkout via WhatsApp</p>
        <p className="mt-1 text-sm text-[#6B7280]">
          Payment is arranged directly with the shop. LaGecto records the order but does not collect payment.
          {groups.length > 1 ? " Items from different shops stay separate — each shop gets its own order and WhatsApp message." : ""}
        </p>
      </div>
      {!signedIn ? (
        <div className="lg-card grid gap-3 p-4">
          <p className="font-semibold">Order without an account</p>
          <p className="text-sm text-[#6B7280]">
            Add your name so the shop can identify the order. WhatsApp then opens so you can arrange payment. Sign in if you want order history or promo codes.
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
        return (
          <section key={shopId} className="lg-card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">{shopName}</h2>
              <Link href={shopHref({ id: shopId })} className="text-sm text-[#0B6E4F]">
                Continue shopping
              </Link>
            </div>
            <div className="grid gap-3">
              {shopItems.map((item) => {
                const quoted = quote?.items.find((row) => row.product_id === item.productId);
                const unit = quoted?.unit_price ?? item.price;
                const list = quoted?.list_price ?? item.price;
                return (
                  <article key={item.productId} className="flex flex-col gap-3 rounded-2xl bg-[#F7F3E3] p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-sm text-[#6B7280]">
                        {money(unit)}
                        {list > unit ? <span className="ml-2 line-through">{money(list)}</span> : null}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        value={item.quantity}
                        onChange={(e) => update(item.productId, Number(e.target.value))}
                        className="w-20 rounded-xl border px-2 py-2"
                        aria-label={`Quantity for ${item.name}`}
                      />
                      <button type="button" className="min-h-11 px-2 text-sm text-[#C2413B]" onClick={() => update(item.productId, 0)}>
                        Remove
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="mt-4 text-right text-sm">
              <p>Subtotal {money(quote?.subtotal ?? shopItems.reduce((sum, item) => sum + item.price * item.quantity, 0))}</p>
              {quote?.discount ? <p>Discounts {money(quote.discount)}</p> : null}
              {quote?.promo_code ? (
                <p className="text-[#0B6E4F]">
                  Promo {quote.promo_code} applied
                  {quote.promo_discount ? ` · saved ${money(quote.promo_discount)}` : ""}
                </p>
              ) : null}
              <p className="text-lg font-semibold">Shop total {money(shopTotal(shopId, shopItems))}</p>
              <p className="text-xs text-[#6B7280]">Displayed totals are estimates. Checkout uses live shop prices.</p>
            </div>
            {signedIn ? (
              <div className="mt-4 rounded-2xl bg-[#F7F3E3] p-4 text-left">
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
            <button
              type="button"
              disabled={busy}
              onClick={() => void checkout(shopId)}
              className="mt-4 w-full rounded-xl bg-[#25D366] px-4 py-3 font-semibold text-white"
            >
              {busy ? "Placing order…" : "Place order & open WhatsApp"}
            </button>
          </section>
        );
      })}
      <button type="button" onClick={clear} className="text-sm text-[#C2413B]">
        Clear cart
      </button>
      {message ? <p className="text-sm text-[#0B6E4F]">{message}</p> : null}
    </div>
  );
}
