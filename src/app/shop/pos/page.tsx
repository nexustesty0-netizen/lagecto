import { createServerSupabase } from "@/lib/supabase/server";
import { featureLockReason, loadOwnedShopWithFeatures } from "@/lib/entitlements";
import { PageHeader } from "@/components/ui/primitives";
import { FeatureLocked, FeatureHint } from "@/components/shop/FeatureLocked";
import { PosClient } from "@/components/shop/PosClient";
import { PosSalesHistory } from "@/components/shop/PosSalesHistory";

export default async function PosPage() {
  const { profile, shop, features, disabledFeatures } = await loadOwnedShopWithFeatures();
  if (!shop) return null;
  const locked = featureLockReason(features, disabledFeatures, "pos");
  if (locked) return <FeatureLocked feature="pos" reason={locked} />;
  const supabase = await createServerSupabase();
  const [{ data: products }, { data: orderCustomers }, { data: employees }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, price, stock, type, is_available, barcode")
      .eq("shop_id", shop.id)
      .eq("is_available", true)
      .order("name"),
    supabase.from("orders").select("customer_id, customer_name").eq("shop_id", shop.id).not("customer_id", "is", null).limit(80),
    supabase.from("employees").select("id, name, is_active").eq("shop_id", shop.id).order("name"),
  ]);
  const [{ data: sales }, { data: receipts }] = await Promise.all([
    supabase
      .from("sales")
      .select("id, sale_number, customer_name, total, status, sale_date, payment_method, cashier_name, order_id")
      .eq("shop_id", shop.id)
      .order("sale_date", { ascending: false })
      .limit(80),
    supabase.from("receipts").select("id, sale_id").eq("shop_id", shop.id),
  ]);
  const receiptBySale = new Map((receipts || []).filter((row) => row.sale_id).map((row) => [row.sale_id as string, row.id]));
  const history = (sales || []).map((sale) => ({ ...sale, receipt_id: receiptBySale.get(sale.id) || null }));

  const priced = await Promise.all(
    (products || []).map(async (product) => {
      const { data } = await supabase.rpc("product_effective_price", { p_product_id: product.id });
      return {
        ...product,
        effective_price: data?.ok ? Number(data.unit_price) : Number(product.price),
        on_sale: Boolean(data?.on_sale),
      };
    }),
  );

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
        subtitle="Record a walk-in sale, then review every sale below. Edit or delete only to correct a mistake — stock is adjusted."
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
      />
      <PosSalesHistory sales={history} />
    </>
  );
}
