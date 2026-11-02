import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiProfile, requireApiShopManage } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/admin-access";
import { jsonError } from "@/lib/api-error";
import { loadChatInbox } from "@/lib/chat";
import { chatViewForRole, type ChatView } from "@/lib/chat-privacy";

function requestedView(value: string | null): ChatView | null {
  if (value === "customer" || value === "shop" || value === "admin") return value;
  return null;
}

export async function GET(request: Request) {
  const auth = await requireApiProfile();
  if (!auth.ok) return auth.error;
  const url = new URL(request.url);
  const view = requestedView(url.searchParams.get("view")) || chatViewForRole(auth.profile.role, isSuperAdmin(auth.profile));
  if (!view) return jsonError("chat.inbox", "Not allowed", 403);
  if (view === "admin" && !isSuperAdmin(auth.profile)) return jsonError("chat.inbox", "Not allowed", 403);
  if (view === "customer" && auth.profile.role !== "customer") return jsonError("chat.inbox", "Not allowed", 403);
  if (view === "shop") {
    const shopAuth = await requireApiShopManage();
    if (!shopAuth.ok) return shopAuth.error;
  }

  const supabase = await createServerSupabase();
  const conversations = await loadChatInbox(supabase, view, auth.profile.id);
  return NextResponse.json({ conversations });
}
