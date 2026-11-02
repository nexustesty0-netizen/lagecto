import { createServerSupabase } from "@/lib/supabase/server";
import { featureLockReason, loadOwnedShopWithFeatures } from "@/lib/entitlements";
import { loadEffectivePrices } from "@/lib/pricing";
import { PageHeader } from "@/components/ui/primitives";
import { FeatureLocked, FeatureHint } from "@/components/shop/FeatureLocked";
import { PosClient } from "@/components/shop/PosClient";
import { PosSalesHistory } from "@/components/shop/PosSalesHistory";
import { staffCanManage } from "@/lib/shop/staff";
import { posDailySummary } from "@/lib/shop/pos";

export default async function PosPage() {
  const { profile, shop, features, disabledFeatures, staffRole } = await loadOwnedShopWithFeatures();
  if (!shop) return null;
  const locked = featureLockReason(features, disabledFeatures, "pos");
  if (locked) return <FeatureLocked feature="pos" reason={locked} />;
  const supabase = await createServerSupabase();
  const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const [{ data: productsWithAvailability, error: productsError }, { data: orderCustomers }, { data: employees }, { data: todaySales }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, name, price, stock, type, is_available, barcode, availability, image, category")
        .eq("shop_id", shop.id)
        .eq("is_available", true)
        .order("name")
        .limit(200),
      supabase.from("orders").select("customer_id, customer_name").eq("shop_id", shop.id).not("customer_id", "is", null).limit(80),
      supabase.from("employees").select("id, name, is_active").eq("shop_id", shop.id).order("name"),
      supabase
        .from("sales")
        .select("total, status, sale_date, payment_method")
        .eq("shop_id", shop.id)
        .gte("sale_date", since),
    ]);
  const { data: sales } = await supabase
    .from("sales")
    .select("id, sale_number, customer_name, total, status, sale_date, payment_method, cashier_name, order_id")
    .eq("shop_id", shop.id)
    .order("sale_date", { ascending: false })
    .limit(80);
  const saleIds = (sales || []).map((sale) => sale.id);
  const { data: receipts } = saleIds.length
    ? await supabase.from("receipts").select("id, sale_id").eq("shop_id", shop.id).in("sale_id", saleIds)
    : { data: [] as { id: string; sale_id: string | null }[] };
  const products = productsError
    ? (
        await supabase
          .from("products")
          .select("id, name, price, stock, type, is_available, barcode, image, category")
          .eq("shop_id", shop.id)
          .eq("is_available", true)
          .order("name")
          .limit(200)
      ).data
    : productsWithAvailability;
  const receiptBySale = new Map((receipts || []).filter((row) => row.sale_id).map((row) => [row.sale_id as string, row.id]));
  const history = (sales || []).map((sale) => ({ ...sale, receipt_id: receiptBySale.get(sale.id) || null }));

  const prices = await loadEffectivePrices(
    (args) => supabase.rpc("product_prices_for_ids", args),
    (products || []).map((product) => product.id),
  );
  const priced = (products || []).map((product) => {
    const row = prices.get(product.id);
    return {
      ...product,
      effective_price: row?.unitPrice ?? Number(product.price),
      on_sale: Boolean(row?.onSale),
    };
  });

  const customers = Object.values(
    (orderCustomers || []).reduce(
      (acc: Record<string, { id: string; name: string }>, row) => {
        if (!row.customer_id) return acc;
        acc[row.customer_id] ??= { id: row.customer_id, name: row.customer_name || "Customer" };
        return acc;
      },
      {},
    ),
  );

  return (
    <>
      <PageHeader
        title="Point of sale"
        subtitle="Search or scan, add to the basket, then complete the sale. Stock and the receipt update only after the till confirms."
      />
      <div className="mb-4">
        <FeatureHint feature="pos" />
      </div>
      <PosClient
        products={priced}
        customers={customers}
        employees={(employees || [])
          .filter((row) => row.is_active !== false)
          .map((row) => ({ id: row.id, name: row.name }))}
        shop={{
          name: shop.name,
          email: shop.email,
          phone: shop.phone,
          whatsapp: shop.whatsapp_number,
          website: shop.website_url,
        }}
        cashierDefault={profile.name || shop.name}
        canManage={staffCanManage(staffRole)}
        daily={posDailySummary(todaySales || [])}
      />
      <PosSalesHistory sales={history} canManage={staffCanManage(staffRole)} />
    </>
  );
}
