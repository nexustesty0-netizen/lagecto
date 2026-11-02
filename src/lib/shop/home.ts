import { createServerSupabase } from "@/lib/supabase/server";
import { loadChatInbox } from "@/lib/chat";
import { rankBestSellers, weekSalesSeries } from "@/lib/shop/dashboard-math";
import { publicDisplayName } from "@/lib/chat-privacy";

function asItems(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export async function loadShopHome(shopId: string, userId: string) {
  const supabase = await createServerSupabase();
  const since = new Date(Date.now() - 8 * 86400000).toISOString();
  const [
    { data: recentSales },
    { data: weekSales },
    { data: notes },
    conversations,
    { data: pendingOrders },
    { count: pendingOrderCount },
    { data: enquiries },
    { count: outOfStock },
    { data: lowStockRows },
    { data: completedSales },
  ] = await Promise.all([
    supabase
      .from("sales")
      .select("id, total, sale_date, sale_number, payment_method")
      .eq("shop_id", shopId)
      .eq("status", "completed")
      .order("sale_date", { ascending: false })
      .limit(6),
    supabase.from("sales").select("total, sale_date").eq("shop_id", shopId).eq("status", "completed").gte("sale_date", since),
    supabase
      .from("shop_notifications")
      .select("id, title, created_at")
      .eq("shop_id", shopId)
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(5),
    loadChatInbox(supabase, "shop", userId).catch(() => []),
    supabase
      .from("orders")
      .select("id, order_number, customer_name, total, status, created_at")
      .eq("shop_id", shopId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("shop_id", shopId).eq("status", "pending"),
    supabase
      .from("service_requests")
      .select("id, title, status, created_at")
      .eq("shop_id", shopId)
      .in("status", ["open", "quoted"])
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("type", "product")
      .or("stock.is.null,stock.lte.0"),
    supabase
      .from("products")
      .select("id, name, stock, low_stock_threshold")
      .eq("shop_id", shopId)
      .eq("type", "product")
      .gt("stock", 0)
      .order("stock", { ascending: true })
      .limit(8),
    supabase
      .from("sales")
      .select("id, sale_items(product_id, product_name, quantity)")
      .eq("shop_id", shopId)
      .eq("status", "completed")
      .order("sale_date", { ascending: false })
      .limit(80),
  ]);

  const lowStock = (lowStockRows || []).filter((row) => {
    const stock = Number(row.stock);
    const threshold = Number(row.low_stock_threshold);
    return Number.isFinite(stock) && Number.isFinite(threshold) && stock <= threshold;
  });

  return {
    recentSales: (recentSales || []).map((sale) => ({
      id: sale.id,
      number: sale.sale_number || "Sale",
      total: Number(sale.total || 0),
      date: sale.sale_date,
      method: sale.payment_method,
    })),
    series: weekSalesSeries(weekSales || []),
    activity: notes || [],
    unreadMessages: conversations.reduce((sum, row) => sum + (row.unread || 0), 0),
    recentChats: conversations.slice(0, 4),
    pendingOrderCount: pendingOrderCount || 0,
    pendingOrders: (pendingOrders || []).map((order) => ({
      id: order.id,
      number: order.order_number,
      total: Number(order.total || 0),
      status: order.status,
      createdAt: order.created_at,
      customerName: publicDisplayName(order.customer_name, "Customer"),
    })),
    enquiries: (enquiries || []).map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
    })),
    outOfStock: outOfStock || 0,
    lowStock: lowStock.map((row) => ({
      id: row.id,
      name: row.name,
      stock: Number(row.stock || 0),
    })),
    bestSellers: rankBestSellers(
      (completedSales || []).map((sale) => ({
        sale_items: asItems(sale.sale_items) as {
          product_id?: string | null;
          product_name?: string | null;
          quantity?: number | null;
        }[],
      })),
      5,
    ),
  };
}
