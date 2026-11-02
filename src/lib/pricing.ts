export type EffectivePrice = {
  unitPrice: number;
  listPrice: number;
  onSale: boolean;
};

export function priceMapFromRpc(data: unknown) {
  const map = new Map<string, EffectivePrice>();
  const rows = Array.isArray(data) ? data : [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const id = String(item.product_id || "");
    if (!id) continue;
    const listPrice = Number(item.list_price || 0);
    const unitPrice = Number(item.unit_price ?? listPrice);
    map.set(id, {
      listPrice,
      unitPrice,
      onSale: Boolean(item.on_sale) || unitPrice < listPrice,
    });
  }
  return map;
}

export async function loadEffectivePrices(
  rpc: (args: { p_product_ids: string[] }) => PromiseLike<{ data: unknown; error: unknown }>,
  ids: string[],
) {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 200);
  if (!unique.length) return new Map<string, EffectivePrice>();
  const { data, error } = await rpc({ p_product_ids: unique });
  if (error) return new Map<string, EffectivePrice>();
  return priceMapFromRpc(data);
}
