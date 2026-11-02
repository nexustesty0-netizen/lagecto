"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime, money, titleCase } from "@/lib/format";
import { SegmentedControl } from "@/components/os/OsUi";
import { inventoryValuation } from "@/lib/shop/inventory-math";

type Product = {
  id: string;
  name: string;
  stock: number | null;
  low_stock_threshold: number | null;
  type: string;
  category?: string | null;
  price?: number | null;
  cost?: number | null;
  barcode?: string | null;
};

type HistoryRow = {
  id: string;
  product_id: string | null;
  transaction_type: string;
  quantity: number | null;
  previous_quantity: number | null;
  new_quantity: number | null;
  reason?: string | null;
  created_at: string;
  created_by?: string | null;
};

type Insights = {
  insufficient_movement_data?: boolean;
  low_stock?: { id: string; name: string; stock: number; threshold: number }[];
  out_of_stock?: { id: string; name: string; stock: number }[];
  recently_restocked?: { product_id: string; name: string; new_quantity: number; created_at: string }[];
  fast_moving?: { id: string; name: string; moved: number }[];
  slow_moving?: { id: string; name: string; stock: number }[];
};

export function InventoryBoard({
  shopId,
  products,
  history,
  insights,
}: {
  shopId: string;
  products: Product[];
  history: HistoryRow[];
  insights?: Insights | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [reason, setReason] = useState("restock");
  const [kind, setKind] = useState<"in" | "out" | "set">("in");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [historyFilter, setHistoryFilter] = useState("all");
  const [selected, setSelected] = useState(products[0]?.id || "");

  const rows = useMemo(() => {
    return products.filter((product) => {
      const stock = Number(product.stock || 0);
      const threshold = Number(product.low_stock_threshold || 0);
      const matchesQuery = `${product.name} ${product.category || ""}`.toLowerCase().includes(query.trim().toLowerCase());
      const matchesFilter =
        filter === "all" ||
        (filter === "out" && stock <= 0) ||
        (filter === "low" && stock > 0 && stock <= threshold);
      return matchesQuery && matchesFilter;
    });
  }, [products, query, filter]);

  const names = useMemo(() => Object.fromEntries(products.map((product) => [product.id, product.name])), [products]);
  const valuation = inventoryValuation(products);
  const historyRows = history.filter((row) => {
    if (historyFilter === "in") return ["received", "returned"].includes(row.transaction_type);
    if (historyFilter === "out") return ["sold", "damaged"].includes(row.transaction_type);
    if (historyFilter === "adjust") return row.transaction_type === "adjustment";
    return true;
  });

  async function adjust(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const res = await fetch("/api/shop/inventory/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: selected,
        kind,
        quantity: Number(quantity),
        target: Number(quantity),
        reason: kind === "set" ? "adjustment" : reason,
        notes,
      }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Unable to adjust stock.");
    else router.refresh();
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <InsightCard title="Low stock" count={insights?.low_stock?.length || 0} />
        <InsightCard title="Out of stock" count={insights?.out_of_stock?.length || 0} />
        <InsightCard
          title="Recorded stock value"
          hint={valuation.missingCostProducts ? `${valuation.missingCostProducts} item${valuation.missingCostProducts === 1 ? "" : "s"} have no cost, so they are omitted.` : "Quantity × recorded cost"}
          value={money(valuation.withCost)}
        />
      </div>

      <section className="os-surface">
        <p className="os-kicker">Needs attention</p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <InsightList title="Low stock" items={(insights?.low_stock || []).map((item) => `${item.name} · ${item.stock}`)} />
          <InsightList title="Out of stock" items={(insights?.out_of_stock || []).map((item) => item.name)} />
          <InsightList
            title="Fast-moving"
            empty={insights?.insufficient_movement_data ? "Not enough data yet." : "No fast movers in the last 30 days."}
            items={(insights?.fast_moving || []).map((item) => `${item.name} · ${item.moved} sold`)}
          />
          <InsightList
            title="Slow-moving"
            empty={insights?.insufficient_movement_data ? "Not enough data yet." : "No slow movers flagged."}
            items={(insights?.slow_moving || []).map((item) => item.name)}
          />
        </div>
      </section>

      <form onSubmit={adjust} className="os-surface grid gap-3 md:grid-cols-4">
        <select value={selected} onChange={(event) => setSelected(event.target.value)} className="rounded-xl border px-3 py-2 md:col-span-2">
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
              {product.barcode ? ` · ${product.barcode}` : ""} · {product.stock ?? 0} on hand
            </option>
          ))}
        </select>
        <select value={kind} onChange={(event) => setKind(event.target.value as "in" | "out" | "set")} className="rounded-xl border px-3 py-2">
          <option value="in">Stock in</option>
          <option value="out">Stock out</option>
          <option value="set">Set counted qty</option>
        </select>
        <input value={quantity} onChange={(event) => setQuantity(event.target.value)} type="number" min={0} className="rounded-xl border px-3 py-2" />
        {kind === "set" ? (
          <p className="text-sm text-[var(--lagecto-muted)] md:col-span-2">Reconciliation writes the difference as an adjustment. Stock cannot go below zero.</p>
        ) : (
          <select value={reason} onChange={(event) => setReason(event.target.value)} className="rounded-xl border px-3 py-2 md:col-span-2">
            {kind === "in" ? (
              <>
                <option value="restock">Restock / received</option>
                <option value="returned">Customer return</option>
              </>
            ) : (
              <>
                <option value="damaged">Damaged</option>
                <option value="sold">Manual sale / write-off</option>
                <option value="adjustment">Correction</option>
              </>
            )}
          </select>
        )}
        <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Note (optional)" className="rounded-xl border px-3 py-2 md:col-span-4" />
        <button className="rounded-full bg-[#0B6E4F] px-4 py-2 text-white md:col-span-4">Record stock change</button>
        {error ? <p className="text-sm text-red-700 md:col-span-4">{error}</p> : null}
      </form>

      <div className="flex flex-wrap gap-2">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" className="min-w-[200px] flex-1 rounded-xl border px-3 py-2" />
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "low", label: "Low" },
            { value: "out", label: "Out" },
          ]}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((product) => {
          const stock = Number(product.stock || 0);
          const threshold = Number(product.low_stock_threshold || 0);
          const tone = stock <= 0 ? "Out of stock" : stock <= threshold ? "Low stock" : "In stock";
          return (
            <article key={product.id} className="os-surface">
              <p className="font-semibold">{product.name}</p>
              <p className="mt-1 text-2xl font-semibold">{stock}</p>
              <p className={`mt-1 text-sm ${stock <= 0 ? "text-[#C2413B]" : stock <= threshold ? "text-amber-700" : "text-[var(--lagecto-muted)]"}`}>{tone}</p>
              <p className="mt-2 text-xs text-[var(--lagecto-muted)]">Alert at {threshold || "—"}</p>
            </article>
          );
        })}
      </div>

      <section className="os-surface">
        <h2 className="mb-3 font-semibold">Stock movement</h2>
        <p className="mb-4 text-sm text-[var(--lagecto-muted)]">History is append-only. Corrections create a new movement. Stock cannot go below zero.</p>
        <div className="mb-3">
          <SegmentedControl
            value={historyFilter}
            onChange={setHistoryFilter}
            options={[
              { value: "all", label: "All" },
              { value: "in", label: "In" },
              { value: "out", label: "Out" },
              { value: "adjust", label: "Adjust" },
            ]}
          />
        </div>
        {!historyRows.length ? (
          <p className="text-sm text-[var(--lagecto-muted)]">Adjustments, POS sales, and refunds appear here.</p>
        ) : (
          <div className="app-table-wrap">
            <table className="app-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Product</th>
                  <th>Reason</th>
                  <th>From</th>
                  <th>Change</th>
                  <th>To</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDateTime(row.created_at)}</td>
                    <td>{row.product_id ? names[row.product_id] || "Product" : "—"}</td>
                    <td>{titleCase(row.reason || row.transaction_type)}</td>
                    <td>{row.previous_quantity ?? "—"}</td>
                    <td>{row.quantity}</td>
                    <td>{row.new_quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function InsightCard({ title, count, value, hint }: { title: string; count?: number; value?: string; hint?: string }) {
  return (
    <article className="os-surface">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--lagecto-muted)]">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value ?? count}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--lagecto-muted)]">{hint}</p> : null}
    </article>
  );
}

function InsightList({ title, items, empty = "None right now." }: { title: string; items: string[]; empty?: string }) {
  return (
    <div>
      <p className="text-sm font-semibold">{title}</p>
      {!items.length ? <p className="mt-1 text-sm text-[var(--lagecto-muted)]">{empty}</p> : (
        <ul className="mt-2 grid gap-1 text-sm">
          {items.slice(0, 5).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
