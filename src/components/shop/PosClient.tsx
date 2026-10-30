"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payments/methods";
import { uniqueShopContacts } from "@/lib/receipts";
import { POS_PAYMENT_METHODS } from "@/lib/shop/ticket";

type Product = {
  id: string;
  name: string;
  price: number;
  stock: number | null;
  type: string;
  barcode?: string | null;
  effective_price?: number;
  on_sale?: boolean;
};

type CustomerOption = { id: string; name: string };
type EmployeeOption = { id: string; name: string };
type ShopContact = { name: string; email?: string | null; phone?: string | null; whatsapp?: string | null; website?: string | null };

type TicketLine = {
  id: string;
  productId?: string | null;
  name: string;
  type: "product" | "service" | "custom";
  quantity: number;
  listPrice: number;
  unitPrice: number;
  stock?: number | null;
};

const POS_METHODS = POS_PAYMENT_METHODS;

export function PosClient({
  products,
  customers,
  employees,
  shop,
  cashierDefault,
}: {
  products: Product[];
  customers: CustomerOption[];
  employees: EmployeeOption[];
  shop: ShopContact;
  cashierDefault: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
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

  function addProduct(product: Product) {
    const stock = Number(product.stock ?? 0);
    const unitPrice = Number(product.effective_price ?? product.price);
    setCart((current) => {
      const existing = current.find((row) => row.productId === product.id);
      const nextQty = (existing?.quantity || 0) + 1;
      if (product.type === "product" && stock < nextQty) {
        setMessage(`${product.name} does not have enough stock.`);
        return current;
      }
      if (existing) {
        return current.map((row) => (row.productId === product.id ? { ...row, quantity: row.quantity + 1 } : row));
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
        },
      ];
    });
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
        .map((row) => (row.id === id ? { ...row, quantity } : row))
        .filter((row) => row.quantity > 0),
    );
  }

  const visible = products.filter((product) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return product.name.toLowerCase().includes(q) || String(product.barcode || "").toLowerCase() === q;
  });
  const listSubtotal = cart.reduce((sum, item) => sum + item.listPrice * item.quantity, 0);
  const charged = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discount = Math.max(listSubtotal - charged, 0);
  const uniqueContact = uniqueShopContacts(shop);
  const contactLine = [uniqueContact.phone, uniqueContact.email, uniqueContact.website]
    .filter(Boolean)
    .join(" · ");

  async function checkout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/shop/pos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cart.map((item) => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        paymentMethod,
        customerName,
        customerId: customerId || null,
        cashierName,
        timeTaken,
        notes,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || "Sale failed.");
      return;
    }
    setCart([]);
    setReceiptId(data.receipt_id || null);
    setMessage(`Sale recorded. Total ${money(data.total)}. Receipt ${data.receipt_number || ""} is ready.`);
    router.refresh();
  }

  const catalog = useMemo(() => visible, [visible]);

  return (
    <div className="pos-ledger grid gap-4 xl:grid-cols-[1.15fr_0.95fr_0.85fr]">
      <section className="pos-page rounded-[28px] p-4">
        <p className="pos-kicker">Catalog</p>
        <h2 className="text-lg font-semibold">Products, services & walk-in work</h2>
        <div className="mt-3 rounded-2xl border bg-white p-3">
          <p className="text-sm font-semibold">Type a service that is not in the list</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_7rem_5rem_auto]">
            <input
              value={customName}
              onChange={(event) => setCustomName(event.target.value)}
              placeholder="Service or item name"
              className="rounded-xl border px-3 py-2"
            />
            <input
              value={customPrice}
              onChange={(event) => setCustomPrice(event.target.value)}
              type="number"
              min={0}
              step="0.01"
              placeholder="Price"
              className="rounded-xl border px-3 py-2"
            />
            <input
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
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search or scan barcode"
          className="mt-3 w-full rounded-xl border px-3 py-2"
        />
        <div className="mt-3 grid max-h-[70vh] gap-2 overflow-y-auto sm:grid-cols-2">
          {catalog.map((product) => (
            <button key={product.id} type="button" onClick={() => addProduct(product)} className="rounded-2xl border bg-white p-3 text-left">
              <p className="font-semibold">{product.name}</p>
              <p className="text-sm text-[#6B7280]">
                {money(product.effective_price ?? product.price)}
                {product.on_sale ? " · promo" : ""}
                {product.type === "product" ? ` · ${product.stock ?? 0} in stock` : " · service"}
              </p>
            </button>
          ))}
        </div>
      </section>

      <form onSubmit={checkout} className="pos-page rounded-[28px] p-4">
        <p className="pos-kicker">Current sale</p>
        <h2 className="text-lg font-semibold">Ticket</h2>
        <ul className="mt-3 grid gap-2 text-sm">
          {cart.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2">
              <span className="min-w-0 flex-1 truncate">
                {item.name}
                {item.type === "custom" ? <span className="ml-1 text-xs text-[#6B7280]">custom</span> : null}
              </span>
              <input
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
          {!cart.length ? <li className="text-[#6B7280]">Add a catalogue item or type a custom service.</li> : null}
        </ul>
        <input
          value={customerName}
          onChange={(event) => setCustomerName(event.target.value)}
          placeholder="Customer name"
          className="mt-4 w-full rounded-xl border px-3 py-2"
        />
        {customers.length ? (
          <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2">
            <option value="">Walk-in / no LaGecto account</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        ) : null}
        <input
          value={timeTaken}
          onChange={(event) => setTimeTaken(event.target.value)}
          placeholder="Time taken (e.g. 45 min)"
          className="mt-2 w-full rounded-xl border px-3 py-2"
        />
        <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2">
          {POS_METHODS.map((method) => (
            <option key={method.value} value={method.value}>
              {method.label}
            </option>
          ))}
        </select>
        {employees.length ? (
          <select
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
        ) : null}
        <input
          value={cashierName}
          onChange={(event) => setCashierName(event.target.value)}
          placeholder="Cashier name"
          className="mt-2 w-full rounded-xl border px-3 py-2"
        />
        <input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Note on receipt (optional)"
          className="mt-2 w-full rounded-xl border px-3 py-2"
        />
        <button disabled={!cart.length || busy} className="mt-4 w-full rounded-2xl bg-[#0B6E4F] py-3 text-white disabled:opacity-50">
          {busy ? "Recording…" : `Record ${paymentMethodLabel(paymentMethod).toLowerCase()} sale`}
        </button>
        {message ? <p className="mt-2 text-sm text-[#0B6E4F]">{message}</p> : null}
        {receiptId ? (
          <a className="mt-2 inline-block text-sm text-[#0B6E4F]" href={`/shop/receipts/${receiptId}`}>
            View receipt
          </a>
        ) : null}
      </form>

      <aside className="pos-summary rounded-[28px] p-4">
        <p className="pos-kicker">Ledger</p>
        <h2 className="text-lg font-semibold">Transaction summary</h2>
        <dl className="mt-4 grid gap-3 text-sm">
          <div className="flex justify-between">
            <dt>Lines</dt>
            <dd>{cart.reduce((sum, item) => sum + item.quantity, 0)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{money(listSubtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Promotions</dt>
            <dd>{discount ? `-${money(discount)}` : "—"}</dd>
          </div>
          <div className="flex justify-between text-lg font-semibold text-[#0B6E4F]">
            <dt>Total</dt>
            <dd>{money(charged)}</dd>
          </div>
        </dl>
        <div className="mt-4 rounded-2xl bg-white p-3 text-sm">
          <p className="font-semibold">{shop.name}</p>
          <p className="mt-1 text-xs leading-5 text-[#6B7280]">
            This shop contact is printed on the receipt if the customer has a question.
          </p>
          <p className="mt-2 text-sm text-[#6B7280]">{contactLine || "Add phone or email in Settings so customers can reach you."}</p>
        </div>
        <p className="mt-3 text-xs leading-5 text-[#6B7280]">
          POS records how the customer paid in person. Marketplace orders still check out on WhatsApp. LaGecto does not collect that payment.
        </p>
      </aside>
    </div>
  );
}
