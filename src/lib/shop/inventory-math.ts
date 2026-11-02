export type StockMoveKind = "in" | "out" | "set";

export function stockMovementType(reason: string): "received" | "sold" | "damaged" | "returned" | "adjustment" {
  const value = String(reason || "").trim().toLowerCase();
  if (value === "restock" || value === "received") return "received";
  if (value === "returned" || value === "return") return "returned";
  if (value === "damaged") return "damaged";
  if (value === "sold") return "sold";
  return "adjustment";
}

export function signedStockDelta(kind: StockMoveKind, quantity: number, current: number, target?: number) {
  const qty = Math.trunc(Math.abs(Number(quantity) || 0));
  const have = Math.trunc(Number(current) || 0);
  if (kind === "in") return qty;
  if (kind === "out") return -qty;
  const next = Math.trunc(Number(target ?? quantity) || 0);
  return next - have;
}

export function inventoryValuation(
  products: { stock?: number | null; cost?: number | null }[],
) {
  let withCost = 0;
  let missingCostProducts = 0;
  let units = 0;
  for (const product of products) {
    const qty = Math.max(0, Number(product.stock || 0));
    units += qty;
    const cost = Number(product.cost);
    if (Number.isFinite(cost) && cost > 0) withCost += cost * qty;
    else missingCostProducts += 1;
  }
  return { withCost: Number(withCost.toFixed(2)), missingCostProducts, units };
}

export function soldQuantities(
  rows: { product_id?: string | null; quantity?: number | null }[],
) {
  const map: Record<string, number> = {};
  for (const row of rows) {
    const id = String(row.product_id || "");
    const qty = Math.max(0, Number(row.quantity || 0));
    if (!id || !qty) continue;
    map[id] = (map[id] || 0) + qty;
  }
  return map;
}
