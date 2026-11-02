import { createServerSupabase } from "@/lib/supabase/server";
import { loadChatInbox } from "@/lib/chat";
import { getProductsByIds, getRecommendations } from "@/lib/marketplace/discovery";
import { shopHref } from "@/lib/storefront/paths";

function shopName(value: unknown) {
  if (!value) return "Shop";
  const row = Array.isArray(value) ? value[0] : value;
  return String((row as { name?: string } | null)?.name || "Shop");
}

export async function loadRecentlyViewed(userId: string, limit = 12) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("marketplace_events")
    .select("product_id, created_at")
    .eq("user_id", userId)
    .eq("event_type", "product_view")
    .not("product_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(80);
  const ids: string[] = [];
  for (const row of data || []) {
    const id = String(row.product_id || "");
    if (id && !ids.includes(id)) ids.push(id);
    if (ids.length >= limit) break;
  }
  return getProductsByIds(ids);
}

export async function loadCustomerHome(userId: string) {
  const supabase = await createServerSupabase();
  const [
    { data: orders },
    { count: orderCount },
    { data: requests },
    { data: saved },
    { count: unreadNotes },
    conversations,
    viewed,
    recommended,
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_number, total, status, payment_status, created_at, shops(name, slug)")
      .eq("customer_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("customer_id", userId),
    supabase
      .from("service_requests")
      .select("id, title, status, created_at, shops(name, slug)")
      .eq("customer_id", userId)
      .in("status", ["open", "quoted"])
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("saved_shops").select("shop_id, shops(id, name, category, slug, logo_url)").eq("user_id", userId).limit(6),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_read", false),
    loadChatInbox(supabase, "customer", userId).catch(() => []),
    loadRecentlyViewed(userId, 8),
    getRecommendations({ userId, limit: 8 }),
  ]);

  const wishlist = (saved || [])
    .map((row) => {
      const related = row.shops as
        | { id: string; name: string; category: string; slug?: string | null; logo_url?: string | null }
        | { id: string; name: string; category: string; slug?: string | null; logo_url?: string | null }[]
        | null;
      return Array.isArray(related) ? related[0] : related;
    })
    .filter((shop): shop is { id: string; name: string; category: string; slug?: string | null; logo_url?: string | null } => Boolean(shop))
    .map((shop) => ({
      id: shop.id,
      name: shop.name,
      category: shop.category,
      href: shopHref(shop),
    }));

  const unreadMessages = conversations.reduce((sum, row) => sum + (row.unread || 0), 0);

  return {
    orderCount: orderCount || 0,
    orders: (orders || []).map((order) => ({
      id: order.id,
      orderNumber: order.order_number,
      total: Number(order.total || 0),
      status: order.status,
      createdAt: order.created_at,
      shopName: shopName(order.shops),
    })),
    enquiries: (requests || []).map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      shopName: shopName(row.shops),
    })),
    wishlist,
    unreadNotes: unreadNotes || 0,
    unreadMessages,
    recentChats: conversations.slice(0, 4),
    viewed,
    recommended: recommended.filter((item) => !viewed.some((view) => view.id === item.id)).slice(0, 8),
  };
}
