import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile, requireApiProfile } from "@/lib/auth/session";

export async function GET() {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const supabase = await createServerSupabase();
  if (profile.role === "shop_owner") {
    const { data: shop } = await supabase
      .from("shops")
      .select("id")
      .or(`owner_user_id.eq.${profile.id},owner_email.eq.${profile.email}`)
      .limit(1)
      .maybeSingle();
    const { data } = shop
      ? await supabase
          .from("shop_notifications")
          .select("id, title, message, type, href, is_read, created_at")
          .eq("shop_id", shop.id)
          .eq("is_read", false)
          .order("created_at", { ascending: false })
          .limit(12)
      : { data: [] };
    return NextResponse.json({ items: data || [], home: "/shop/notifications" });
  }
  const { data } = await supabase
    .from("notifications")
    .select("id, title, message, type, href, is_read, created_at")
    .eq("user_id", profile.id)
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(12);
  return NextResponse.json({
    items: data || [],
    home: profile.role === "admin" ? "/admin/chat" : "/customer/notifications",
  });
}

export async function POST(request: Request) {
  const auth = await requireApiProfile();
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const supabase = await createServerSupabase();
  if (body.preferences && typeof body.preferences === "object") {
    const current = await supabase.from("user_settings").select("notification_preferences").eq("user_id", auth.profile.id).maybeSingle();
    const next = {
      ...((current.data?.notification_preferences as Record<string, unknown>) || {}),
      ...body.preferences,
    };
    await supabase.from("user_settings").upsert({
      user_id: auth.profile.id,
      notification_preferences: next,
      updated_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  }
  const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
  const action = String(body.action || (ids.length ? "read" : "read"));
  if (auth.profile.role === "shop_owner") {
    const { data: shop } = await supabase
      .from("shops")
      .select("id")
      .or(`owner_user_id.eq.${auth.profile.id},owner_email.eq.${auth.profile.email}`)
      .limit(1)
      .maybeSingle();
    if (!shop) return NextResponse.json({ ok: true });
    if (action === "clear") {
      await supabase.from("shop_notifications").delete().eq("shop_id", shop.id);
    } else if (action === "delete" && ids.length) {
      await supabase.from("shop_notifications").delete().eq("shop_id", shop.id).in("id", ids);
    } else if (ids.length) {
      await supabase.from("shop_notifications").update({ is_read: true }).eq("shop_id", shop.id).in("id", ids);
    }
  } else if (action === "clear") {
    await supabase.from("notifications").delete().eq("user_id", auth.profile.id);
  } else if (action === "delete" && ids.length) {
    await supabase.from("notifications").delete().eq("user_id", auth.profile.id).in("id", ids);
  } else if (ids.length) {
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", auth.profile.id).in("id", ids);
  }
  return NextResponse.json({ ok: true });
}
