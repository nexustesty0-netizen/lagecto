import { createServerSupabase } from "@/lib/supabase/server";
import { groupShopCustomers, type ShopCustomerSource } from "@/lib/shop/customers";

export async function loadShopCustomers(shopId: string) {
  const supabase = await createServerSupabase();
  const [{ data: orders }, { data: sales }, { data: enquiries }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, customer_id, customer_name, customer_email, customer_phone, total, status, created_at")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false })
      .limit(400),
    supabase
      .from("sales")
      .select("id, customer_id, customer_name, total, status, sale_date")
      .eq("shop_id", shopId)
      .eq("status", "completed")
      .order("sale_date", { ascending: false })
      .limit(400),
    supabase
      .from("service_requests")
      .select("id, customer_id, customer_name, title, status, created_at")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const rows: ShopCustomerSource[] = [
    ...(orders || []).map((row) => ({
      ...row,
      kind: "order" as const,
      title: "Order",
    })),
    ...(sales || []).map((row) => ({
      customer_id: row.customer_id,
      customer_name: row.customer_name,
      total: row.total,
      created_at: row.sale_date,
      kind: "sale" as const,
      title: "Sale",
      status: row.status,
      id: row.id,
    })),
    ...(enquiries || []).map((row) => ({
      customer_id: row.customer_id,
      customer_name: row.customer_name,
      title: row.title,
      status: row.status,
      created_at: row.created_at,
      kind: "enquiry" as const,
      id: row.id,
    })),
  ];

  return groupShopCustomers(rows);
}
