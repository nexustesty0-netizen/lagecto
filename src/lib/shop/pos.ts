export type PosCatalogProduct = {
  id: string;
  name: string;
  price: number;
  stock?: number | null;
  type?: string | null;
  barcode?: string | null;
  category?: string | null;
  image?: string | null;
  availability?: string | null;
  is_available?: boolean | null;
  effective_price?: number;
};

export type PosRequestedItem = {
  product_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
};

export type PosTicketLine = {
  listPrice: number;
  unitPrice: number;
  quantity: number;
};

export type PosDaySale = {
  total?: number | null;
  status?: string | null;
  sale_date?: string | null;
  payment_method?: string | null;
};

export type PosEffectivePrice = {
  unitPrice: number;
  listPrice?: number;
  onSale?: boolean;
};

export const MAX_CUSTOM_UNIT_PRICE = 1_000_000;
export const SHOP_TICKET_CATALOG_SELECT = "id, name, price, stock, type, availability, is_available";

function onOrder(value?: string | null) {
  return String(value || "") === "on_order";
}

function harareDay(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Harare",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function posCategoryKey(category?: string | null) {
  return String(category || "").trim().toLowerCase() || "uncategorised";
}

export function posCategoryLabel(category?: string | null) {
  const key = posCategoryKey(category);
  if (key === "uncategorised") return "Uncategorised";
  return String(category || "").trim();
}

export function posCategories(products: { category?: string | null }[]) {
  const seen = new Set<string>();
  const rows: { key: string; label: string }[] = [];
  for (const product of products) {
    const key = posCategoryKey(product.category);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ key, label: posCategoryLabel(product.category) });
  }
  return rows.sort((a, b) => a.label.localeCompare(b.label));
}

export function matchPosBarcode(products: PosCatalogProduct[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  return products.find((product) => String(product.barcode || "").trim().toLowerCase() === q) || null;
}

export function filterPosCatalog(products: PosCatalogProduct[], query: string, category = "all") {
  const q = query.trim().toLowerCase();
  const cat = category.trim().toLowerCase();
  return products.filter((product) => {
    if (cat && cat !== "all" && posCategoryKey(product.category) !== cat) return false;
    if (!q) return true;
    return (
      product.name.toLowerCase().includes(q) ||
      String(product.barcode || "").trim().toLowerCase() === q ||
      String(product.category || "").toLowerCase().includes(q)
    );
  });
}

export function posAllowsQty(product: PosCatalogProduct, qty: number) {
  if (product.type !== "product") return true;
  if (onOrder(product.availability)) return true;
  return Number(product.stock || 0) >= Math.max(1, Math.trunc(qty) || 0);
}

export function posCatalogUnitPrice(product: PosCatalogProduct) {
  return Number(product.effective_price ?? product.price ?? 0);
}

export function posTicketTotals(lines: PosTicketLine[]) {
  const listSubtotal = lines.reduce((sum, item) => sum + Number(item.listPrice || 0) * Number(item.quantity || 0), 0);
  const charged = lines.reduce((sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 0), 0);
  const promoDiscount = Math.max(listSubtotal - charged, 0);
  return {
    listSubtotal: Number(listSubtotal.toFixed(2)),
    charged: Number(charged.toFixed(2)),
    promoDiscount: Number(promoDiscount.toFixed(2)),
  };
}

export function applyAuthorisedDiscount(charged: number, extra: number, allowed: boolean) {
  const base = Math.max(0, Number(charged) || 0);
  if (!allowed) return { extra: 0, total: Number(base.toFixed(2)) };
  const amount = Math.max(0, Number(extra) || 0);
  const clipped = Math.min(amount, base);
  return { extra: Number(clipped.toFixed(2)), total: Number((base - clipped).toFixed(2)) };
}

export function posDailySummary(sales: PosDaySale[], now = new Date()) {
  const today = harareDay(now);
  let count = 0;
  let total = 0;
  const byMethod: Record<string, number> = {};
  for (const sale of sales) {
    const status = String(sale.status || "").toLowerCase();
    if (status === "cancelled" || status === "refunded") continue;
    if (!sale.sale_date || harareDay(sale.sale_date) !== today) continue;
    const amount = Number(sale.total || 0);
    count += 1;
    total += amount;
    const method = String(sale.payment_method || "other").toLowerCase();
    byMethod[method] = Number(((byMethod[method] || 0) + amount).toFixed(2));
  }
  return { count, total: Number(total.toFixed(2)), byMethod };
}

export function normalizeIdempotencyKey(value: unknown) {
  const key = String(value || "").trim();
  if (key.length < 8 || key.length > 80) return null;
  return key;
}

export function mapShopTicketItems(items: unknown): PosRequestedItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const productId = String(row.productId || row.product_id || "").trim();
    return {
      product_id: productId || null,
      name: String(row.name || row.product_name || "").trim(),
      quantity: Number(row.quantity || 1),
      unit_price: Number(row.unitPrice ?? row.unit_price ?? row.price ?? 0),
    };
  });
}

export async function priceShopTicketItems(
  requested: PosRequestedItem[],
  loadCatalog: (ids: string[]) => Promise<PosCatalogProduct[]>,
  loadPrices: (ids: string[]) => Promise<Map<string, PosEffectivePrice>>,
): Promise<{ items?: PosRequestedItem[]; error?: string }> {
  if (!requested.length) return { error: "Add at least one item." };
  const catalogIds = [...new Set(requested.map((item) => item.product_id).filter((id): id is string => Boolean(id)))];
  const catalog = catalogIds.length ? await loadCatalog(catalogIds) : [];
  const prices = await loadPrices(catalog.map((product) => product.id));
  return resolvePosApiItems(requested, catalog, prices);
}

export function resolvePosApiItems(
  requested: PosRequestedItem[],
  catalog: PosCatalogProduct[],
  prices: Map<string, PosEffectivePrice>,
): { items?: PosRequestedItem[]; error?: string } {
  const byId = new Map(catalog.map((product) => [product.id, product]));
  const items: PosRequestedItem[] = [];
  for (const item of requested) {
    const quantity = Math.max(1, Math.trunc(Number(item.quantity) || 0));
    if (!item.product_id) {
      const name = String(item.name || "").trim();
      const unitPrice = Number(item.unit_price);
      if (!name) return { error: "Type a service or item name." };
      if (!Number.isFinite(unitPrice) || unitPrice < 0) return { error: "Enter a valid price." };
      if (unitPrice > MAX_CUSTOM_UNIT_PRICE) return { error: "Price is too large." };
      items.push({ product_id: null, name, quantity, unit_price: Number(unitPrice.toFixed(2)) });
      continue;
    }
    const product = byId.get(item.product_id);
    if (!product || product.is_available === false) {
      return { error: "One of the items is no longer for sale." };
    }
    if (!posAllowsQty(product, quantity)) {
      return { error: `${product.name} does not have enough stock.` };
    }
    const unitPrice = prices.get(product.id)?.unitPrice ?? Number(product.price || 0);
    items.push({
      product_id: product.id,
      name: product.name,
      quantity,
      unit_price: Number(unitPrice.toFixed(2)),
    });
  }
  return { items };
}
