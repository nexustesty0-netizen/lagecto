import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile, loadShopForProfile, requireApiProfile } from "@/lib/auth/session";
import { CASHIER_NOTICE_TYPES, type NoticeAudience } from "@/lib/notifications";
import { parseNoticePrefs } from "@/lib/notification-prefs";

export const dynamic = "force-dynamic";

function audienceFor(role: string, useShop: boolean): NoticeAudience {
  if (useShop) return "shop";
  if (role === "admin") return "admin";
  return "customer";
}

export async function GET() {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const packed = await loadShopForProfile(profile);
  const supabase = await createServerSupabase();
  const prefsRow = await supabase.from("user_settings").select("notification_preferences").eq("user_id", profile.id).maybeSingle();
  const prefs = parseNoticePrefs(prefsRow.data?.notification_preferences);
  const useShop = Boolean(packed.shop && packed.staffRole);
  const cashier = packed.staffRole === "cashier";

  if (useShop && packed.shop) {
    let listQuery = supabase
      .from("shop_notifications")
      .select("id, title, message, type, href, reference_id, is_read, created_at")
      .eq("shop_id", packed.shop.id)
      .eq("is_read", false);
    let countQuery = supabase.from("shop_notifications").select("id", { count: "exact", head: true }).eq("shop_id", packed.shop.id).eq("is_read", false);
    if (cashier) {
      listQuery = listQuery.in("type", [...CASHIER_NOTICE_TYPES]);
      countQuery = countQuery.in("type", [...CASHIER_NOTICE_TYPES]);
    }
    listQuery = listQuery.order("created_at", { ascending: false }).limit(12);
    const [{ data }, countRes] = await Promise.all([listQuery, countQuery]);
    const unread = countRes.count ?? (data || []).length;
    return NextResponse.json({
      items: data || [],
      home: "/shop/notifications",
      unread,
      audience: "shop",
      userId: profile.id,
      shopId: packed.shop.id,
      staffRole: packed.staffRole,
      prefs,
    });
  }

  const [{ data }, countRes] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, title, message, type, href, reference_id, is_read, created_at")
      .eq("user_id", profile.id)
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", profile.id).eq("is_read", false),
  ]);
  const unread = countRes.count ?? (data || []).length;
  const audience = audienceFor(profile.role, false);
  return NextResponse.json({
    items: data || [],
    home: audience === "admin" ? "/admin/notifications" : "/customer/notifications",
    unread,
    audience,
    userId: profile.id,
    shopId: null,
    staffRole: packed.staffRole,
    prefs,
  });
}

export async function POST(request: Request) {
  const auth = await requireApiProfile();
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const supabase = await createServerSupabase();
  if (body.preferences && typeof body.preferences === "object") {
    const current = await supabase.from("user_settings").select("notification_preferences").eq("user_id", auth.profile.id).maybeSingle();
    const next = parseNoticePrefs({
      ...((current.data?.notification_preferences as Record<string, unknown>) || {}),
      ...body.preferences,
      categories: {
        ...parseNoticePrefs(current.data?.notification_preferences).categories,
        ...((body.preferences as { categories?: Record<string, unknown> }).categories || {}),
      },
    });
    await supabase.from("user_settings").upsert({
      user_id: auth.profile.id,
      notification_preferences: next,
      updated_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, prefs: next });
  }

  const packed = await loadShopForProfile(auth.profile);
  const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
  const action = String(body.action || "read");
  const useShop = Boolean(packed.shop && packed.staffRole);

  let error: { message?: string } | null = null;
  if (useShop && packed.shop) {
    const shopId = packed.shop.id;
    if (action === "clear") {
      ({ error } = await supabase.from("shop_notifications").delete().eq("shop_id", shopId));
    } else if (action === "delete" && ids.length) {
      ({ error } = await supabase.from("shop_notifications").delete().eq("shop_id", shopId).in("id", ids));
    } else if (action === "read" || action === "read_all") {
      let query = supabase
        .from("shop_notifications")
        .update({ is_read: true })
        .eq("shop_id", shopId)
        .eq("is_read", false)
        .select("id");
      if (action === "read" && ids.length) query = query.in("id", ids);
      ({ error } = await query);
    }
  } else if (action === "clear") {
    ({ error } = await supabase.from("notifications").delete().eq("user_id", auth.profile.id));
  } else if (action === "delete" && ids.length) {
    ({ error } = await supabase.from("notifications").delete().eq("user_id", auth.profile.id).in("id", ids));
  } else if (action === "read" || action === "read_all") {
    let query = supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", auth.profile.id)
      .eq("is_read", false)
      .select("id");
    if (action === "read" && ids.length) query = query.in("id", ids);
    ({ error } = await query);
  }

  if (error) {
    return jsonError("notifications", "Unable to update notifications.", 400, error);
  }
  return NextResponse.json({ ok: true });
}
