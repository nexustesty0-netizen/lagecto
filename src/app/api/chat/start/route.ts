import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiProfile, requireApiShopManage } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/admin-access";
import { jsonError } from "@/lib/api-error";
import { chatStartArgs } from "@/lib/chat-privacy";

export async function POST(request: Request) {
  const auth = await requireApiProfile();
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const superAdmin = isSuperAdmin(auth.profile);
  const args = chatStartArgs({ role: auth.profile.role, isSuperAdmin: superAdmin }, body);
  if (!args) return jsonError("chat.start", "Not allowed", 403);

  if (args.p_kind === "shop_admin" && !superAdmin) {
    const shopAuth = await requireApiShopManage();
    if (!shopAuth.ok) return shopAuth.error;
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("start_chat_conversation", args);
  if (error) return jsonError("chat.start", "Unable to start this conversation.", 400, error);
  if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json({ ok: true, conversation_id: data?.conversation_id });
}
