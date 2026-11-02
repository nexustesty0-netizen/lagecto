"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payments/methods";
import { uniqueShopContacts } from "@/lib/receipts";
import { POS_PAYMENT_METHODS } from "@/lib/shop/ticket";
import { isOnOrder } from "@/lib/product-availability";
import { productImage } from "@/lib/placeholder-cover";
import {
  applyAuthorisedDiscount,
  filterPosCatalog,
  matchPosBarcode,
  posAllowsQty,
  posCatalogUnitPrice,
  posCategories,
  posTicketTotals,
  type PosCatalogProduct,
} from "@/lib/shop/pos";

type Product = PosCatalogProduct;

type CustomerOption = { id: string; name: string };
type EmployeeOption = { id: string; name: string };
type ShopContact = { name: string; email?: string | null; phone?: string | null; whatsapp?: string | null; website?: string | null };
type DailySummary = { count: number; total: number; byMethod: Record<string, number> };

type TicketLine = {
  id: string;
  productId?: string | null;
  name: string;
  type: "product" | "service" | "custom";
  quantity: number;
  listPrice: number;
  unitPrice: number;
  stock?: number | null;
  availability?: string | null;
};

const POS_METHODS = POS_PAYMENT_METHODS;

function newAttemptKey() {
  return crypto.randomUUID();
}

export function PosClient({
  products,
  customers,
  employees,
  shop,
  cashierDefault,
  canManage = false,
  daily,
}: {
  products: Product[];
  customers: CustomerOption[];
  employees: EmployeeOption[];
  shop: ShopContact;
  cashierDefault: string;
  canManage?: boolean;
  daily: DailySummary;
}) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const attemptKey = useRef(newAttemptKey());
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [cart, setCart] = useState<TicketLine[]>([]);
  const [message, setMessage] = useState("");
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customQty, setCustomQty] = useState("1");
  const [timeTaken, setTimeTaken] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashierName, setCashierName] = useState(cashierDefault);
  const [notes, setNotes] = useState("");
  const [extraDiscount, setExtraDiscount] = useState("");

  const categories = useMemo(() => posCategories(products), [products]);
  const catalog = useMemo(() => filterPosCatalog(products, query, category), [products, query, category]);
  const ticket = posTicketTotals(cart);
  const authorised = applyAuthorisedDiscount(ticket.charged, Number(extraDiscount || 0), canManage);
  const uniqueContact = uniqueShopContacts(shop);
  const contactLine = [uniqueContact.phone, uniqueContact.email, uniqueContact.website].filter(Boolean).join(" · ");

  function focusSearch() {
    searchRef.current?.focus();
  }

  function addProduct(product: Product) {
    const unitPrice = posCatalogUnitPrice(product);
    setCart((current) => {
      const existing = current.find((row) => row.productId === product.id);
      const nextQty = (existing?.quantity || 0) + 1;
      if (!posAllowsQty(product, nextQty)) {
        setMessage(`${product.name} does not have enough stock.`);
        return current;
      }
      setMessage("");
      if (existing) {
        return current.map((row) => (row.productId === product.id ? { ...row, quantity: nextQty } : row));
      }
      return [
        ...current,
        {
          id: product.id,
          productId: product.id,
          name: product.name,
          type: product.type === "service" ? "service" : "product",
          quantity: 1,
          listPrice: Number(product.price),
          unitPrice,
          stock: product.stock,
          availability: product.availability,
        },
      ];
    });
    focusSearch();
  }

  function scanQuery() {
    const match = matchPosBarcode(products, query);
    if (match) {
      addProduct(match);
      setQuery("");
      return true;
    }
    if (catalog.length === 1) {
      addProduct(catalog[0]);
      setQuery("");
      return true;
    }
    return false;
  }

  function addCustom() {
    const name = customName.trim();
    const unitPrice = Number(customPrice);
    const quantity = Math.max(1, Number(customQty || 1));
    if (!name) {
      setMessage("Type the service or item name.");
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setMessage("Enter a valid price.");
      return;
    }
    setCart((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        productId: null,
        name,
        type: "custom",
        quantity,
        listPrice: unitPrice,
        unitPrice,
      },
    ]);
    setCustomName("");
    setCustomPrice("");
    setCustomQty("1");
    setMessage("");
  }

  function setQty(id: string, quantity: number) {
    setCart((current) =>
      current
        .map((row) => {
          if (row.id !== id) return row;
          const next = Math.max(0, Math.trunc(Number(quantity) || 0));
          const product = products.find((item) => item.id === row.productId);
          if (product && next > 0 && !posAllowsQty(product, next)) {
            setMessage(`${product.name} does not have enough stock.`);
            return { ...row, quantity: Math.max(1, Number(product.stock || 0)) };
          }
          return { ...row, quantity: next };
        })
        .filter((row) => row.quantity > 0),
    );
  }

  async function checkout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !cart.length) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/shop/pos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((item) => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.productId ? undefined : item.unitPrice,
          })),
          paymentMethod,
          customerName,
          customerId: customerId || null,
          cashierName,
          timeTaken,
          notes,
          extraDiscount: canManage ? authorised.extra : 0,
          idempotencyKey: attemptKey.current,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error || "Sale failed.");
        return;
      }
      attemptKey.current = newAttemptKey();
      setCart([]);
      setExtraDiscount("");
      setReceiptId(data.receipt_id || null);
      const replayed = data.replayed ? "Sale already recorded. " : "";
      setMessage(`${replayed}Sale recorded. Total ${money(data.total)}. Receipt ${data.receipt_number || ""} is ready.`);
      router.refresh();
    } catch {
      setMessage("Unable to record this sale. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <section className="pos-summary rounded-[var(--lg-radius)] p-4">
        <p className="pos-kicker">Today</p>
        <h2 className="text-lg font-semibold">Daily sales summary</h2>
        <dl className="mt-3 flex flex-wrap gap-6 text-sm">
          <div>
            <dt className="text-xs text-[#6B7280]">Sales</dt>
            <dd className="text-lg font-semibold">{daily.count}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#6B7280]">Takings</dt>
            <dd className="text-lg font-semibold text-[#0B6E4F]">{money(daily.total)}</dd>
          </div>
          {Object.entries(daily.byMethod).map(([method, amount]) => (
            <div key={method}>
              <dt className="text-xs text-[#6B7280]">{paymentMethodLabel(method)}</dt>
              <dd className="font-semibold">{money(amount)}</dd>
            </div>
          ))}
        </dl>
        {!daily.count ? <p className="mt-2 text-sm text-[#6B7280]">No completed sales yet today.</p> : null}
      </section>

      <div className="pos-workspace grid gap-4 xl:grid-cols-[1.2fr_0.9fr]">
        <section className="pos-page rounded-[var(--lg-radius)] p-4">
          <p className="pos-kicker">Catalog</p>
          <h2 className="text-lg font-semibold">Search, scan, and add</h2>
          <label className="sr-only" htmlFor="pos-search">
            Search or scan barcode
          </label>
          <input
            ref={searchRef}
            id="pos-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              scanQuery();
            }}
            placeholder="Search or scan barcode"
            className="mt-3 w-full rounded-xl border px-3 py-2"
            autoComplete="off"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategory("all")}
              className={`rounded-full px-3 py-1 text-sm ${category === "all" ? "bg-[#0B6E4F] text-white" : "border bg-white"}`}
            >
              All
            </button>
            {categories.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setCategory(item.key)}
                className={`rounded-full px-3 py-1 text-sm ${category === item.key ? "bg-[#0B6E4F] text-white" : "border bg-white"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="pos-product-grid mt-3 grid max-h-[70vh] gap-2 overflow-y-auto sm:grid-cols-2">
            {catalog.map((product) => {
              const out = product.type === "product" && !isOnOrder(product.availability) && Number(product.stock || 0) <= 0;
              return (
                <button
                  key={product.id}
                  type="button"
                  disabled={out}
                  onClick={() => addProduct(product)}
                  className="flex gap-3 rounded-2xl border bg-white p-2 text-left disabled:opacity-50"
                >
                  <img
                    src={productImage(product.image, product.category)}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-xl object-cover"
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold">{product.name}</span>
                    <span className="mt-1 block text-sm text-[#6B7280]">
                      {money(posCatalogUnitPrice(product))}
                      {product.effective_price != null && product.effective_price < Number(product.price) ? " · promo" : ""}
                      {product.type === "product"
                        ? isOnOrder(product.availability)
                          ? " · available on order"
                          : out
                            ? " · out of stock"
                            : ` · ${product.stock ?? 0} in stock`
                        : " · service"}
                    </span>
                  </span>
                </button>
              );
            })}
            {!catalog.length ? <p className="text-sm text-[#6B7280]">No matching products.</p> : null}
          </div>
        </section>

        <form onSubmit={checkout} className="pos-page rounded-[var(--lg-radius)] p-4">
          <p className="pos-kicker">Current sale</p>
          <h2 className="text-lg font-semibold">Basket</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {cart.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2">
                <span className="min-w-0 flex-1 truncate">
                  {item.name}
                  {item.type === "custom" ? <span className="ml-1 text-xs text-[#6B7280]">custom</span> : null}
                </span>
                <label className="sr-only" htmlFor={`pos-qty-${item.id}`}>
                  Quantity for {item.name}
                </label>
                <input
                  id={`pos-qty-${item.id}`}
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(event) => setQty(item.id, Number(event.target.value || 1))}
                  className="w-16 rounded-lg border px-2 py-1"
                />
                <span className="w-20 text-right">{money(item.unitPrice * item.quantity)}</span>
                <button type="button" className="text-xs text-red-700" onClick={() => setQty(item.id, 0)}>
                  Remove
                </button>
              </li>
            ))}
            {!cart.length ? <li className="text-[#6B7280]">Tap a product or add an unlisted item.</li> : null}
          </ul>

          <div className="mt-4 rounded-2xl border bg-white p-3">
            <p className="text-sm font-semibold">Unlisted item or walk-in service</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_7rem_5rem_auto]">
              <label className="sr-only" htmlFor="pos-custom-name">
                Service or item name
              </label>
              <input
                id="pos-custom-name"
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                placeholder="Service or item name"
                className="rounded-xl border px-3 py-2"
              />
              <label className="sr-only" htmlFor="pos-custom-price">
                Price
              </label>
              <input
                id="pos-custom-price"
                value={customPrice}
                onChange={(event) => setCustomPrice(event.target.value)}
                type="number"
                min={0}
                step="0.01"
                placeholder="Price"
                className="rounded-xl border px-3 py-2"
              />
              <label className="sr-only" htmlFor="pos-custom-qty">
                Quantity
              </label>
              <input
                id="pos-custom-qty"
                value={customQty}
                onChange={(event) => setCustomQty(event.target.value)}
                type="number"
                min={1}
                placeholder="Qty"
                className="rounded-xl border px-3 py-2"
              />
              <button type="button" className="min-h-11 rounded-xl bg-[#0B6E4F] px-4 py-2 text-sm font-semibold text-white" onClick={addCustom}>
                Add
              </button>
            </div>
          </div>

          <label className="sr-only" htmlFor="pos-customer-name">
            Customer name
          </label>
          <input
            id="pos-customer-name"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="Customer name"
            className="mt-4 w-full rounded-xl border px-3 py-2"
          />
          {customers.length ? (
            <>
              <label className="sr-only" htmlFor="pos-customer-id">
                Linked customer
              </label>
              <select
                id="pos-customer-id"
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                className="mt-2 w-full rounded-xl border px-3 py-2"
              >
                <option value="">Walk-in / no LaGecto account</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          <label className="sr-only" htmlFor="pos-time-taken">
            Time taken
          </label>
          <input
            id="pos-time-taken"
            value={timeTaken}
            onChange={(event) => setTimeTaken(event.target.value)}
            placeholder="Time taken (e.g. 45 min)"
            className="mt-2 w-full rounded-xl border px-3 py-2"
          />
          <label className="sr-only" htmlFor="pos-payment-method">
            Payment method
          </label>
          <select
            id="pos-payment-method"
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value)}
            className="mt-2 w-full rounded-xl border px-3 py-2"
          >
            {POS_METHODS.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>
          {employees.length ? (
            <>
              <label className="sr-only" htmlFor="pos-cashier-select">
                Cashier
              </label>
              <select
                id="pos-cashier-select"
                value={employees.some((row) => row.name === cashierName) ? cashierName : ""}
                onChange={(event) => setCashierName(event.target.value || cashierDefault)}
                className="mt-2 w-full rounded-xl border px-3 py-2"
              >
                <option value="">Cashier: type a name below</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.name}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          <label className="sr-only" htmlFor="pos-cashier-name">
            Cashier name
          </label>
          <input
            id="pos-cashier-name"
            value={cashierName}
            onChange={(event) => setCashierName(event.target.value)}
            placeholder="Cashier name"
            className="mt-2 w-full rounded-xl border px-3 py-2"
          />
          <label className="sr-only" htmlFor="pos-notes">
            Note on receipt
          </label>
          <input
            id="pos-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Note on receipt (optional)"
            className="mt-2 w-full rounded-xl border px-3 py-2"
          />
          {canManage ? (
            <>
              <label className="mt-2 block text-sm font-medium" htmlFor="pos-extra-discount">
                Authorised discount
              </label>
              <input
                id="pos-extra-discount"
                value={extraDiscount}
                onChange={(event) => setExtraDiscount(event.target.value)}
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                className="mt-1 w-full rounded-xl border px-3 py-2"
              />
            </>
          ) : null}

          <dl className="mt-4 grid gap-2 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{money(ticket.listSubtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Promotions</dt>
              <dd>{ticket.promoDiscount ? `-${money(ticket.promoDiscount)}` : "—"}</dd>
            </div>
            {canManage && authorised.extra ? (
              <div className="flex justify-between">
                <dt>Authorised discount</dt>
                <dd>-{money(authorised.extra)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between text-lg font-semibold text-[#0B6E4F]">
              <dt>Total</dt>
              <dd>{money(authorised.total)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-[#6B7280]">{contactLine || "Add phone or email in Settings so customers can reach you."}</p>

          <button disabled={!cart.length || busy} className="mt-4 w-full rounded-2xl bg-[#0B6E4F] py-3 text-white disabled:opacity-50">
            {busy ? "Recording…" : `Complete ${paymentMethodLabel(paymentMethod).toLowerCase()} sale`}
          </button>
          {message ? <p className="mt-2 text-sm text-[#0B6E4F]">{message}</p> : null}
          {receiptId ? (
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              <a className="font-semibold text-[#0B6E4F]" href={`/shop/receipts/${receiptId}`}>
                View receipt
              </a>
              <a className="font-semibold text-[#0B6E4F]" href={`/shop/receipts/${receiptId}?print=1`} target="_blank" rel="noreferrer">
                Print receipt
              </a>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
