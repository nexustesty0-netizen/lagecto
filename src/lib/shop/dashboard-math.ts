export function harareDateKey(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Harare",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function weekSalesSeries(
  rows: { total?: number | null; sale_date?: string | null }[],
  now = new Date(),
) {
  const keys: string[] = [];
  const labels: string[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(now.getTime() - i * 86400000);
    keys.push(harareDateKey(day));
    labels.push(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Harare", weekday: "short" }).format(day));
  }
  const totals = Object.fromEntries(keys.map((key) => [key, 0]));
  for (const row of rows) {
    if (!row.sale_date) continue;
    const key = harareDateKey(row.sale_date);
    if (key in totals) totals[key] += Number(row.total || 0);
  }
  return keys.map((key, index) => ({ label: labels[index], value: Number(totals[key].toFixed(2)) }));
}

export function rankBestSellers(
  sales: {
    sale_items?: { product_id?: string | null; product_name?: string | null; quantity?: number | null }[] | null;
  }[],
  limit = 5,
) {
  const map = new Map<string, { id: string | null; name: string; quantity: number }>();
  for (const sale of sales) {
    for (const item of sale.sale_items || []) {
      const quantity = Math.max(0, Number(item.quantity || 0));
      if (!quantity) continue;
      const name = String(item.product_name || "Item").trim() || "Item";
      const key = String(item.product_id || name);
      const current = map.get(key) || { id: item.product_id || null, name, quantity: 0 };
      current.quantity += quantity;
      if (!current.id && item.product_id) current.id = item.product_id;
      map.set(key, current);
    }
  }
  return [...map.values()].sort((a, b) => b.quantity - a.quantity).slice(0, limit);
}
