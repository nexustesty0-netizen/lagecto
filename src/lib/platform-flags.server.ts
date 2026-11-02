import { createServerSupabase } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SELF_SERVE_SHOP_CREATION } from "@/lib/platform-flags";
import { SELF_SERVE_SHOP_LIMIT } from "@/lib/shop/staff";

export type SelfServePortal = {
  open: boolean;
  used: number;
  limit: number;
  remaining: number;
};

export async function platformFlagEnabled(
  key: string,
  fallback = false,
  client?: SupabaseClient,
): Promise<boolean> {
  try {
    const supabase = client || (await createServerSupabase());
    const { data, error } = await supabase.from("platform_flags").select("enabled").eq("key", key).maybeSingle();
    if (error || data == null) return fallback;
    return Boolean(data.enabled);
  } catch {
    return fallback;
  }
}

export async function selfServeShopPortal(client?: SupabaseClient): Promise<SelfServePortal> {
  const fallback: SelfServePortal = { open: false, used: 0, limit: SELF_SERVE_SHOP_LIMIT, remaining: 0 };
  try {
    const supabase = client || (await createServerSupabase());
    const { data, error } = await supabase.rpc("self_serve_shop_portal");
    if (error || !data) {
      const enabled = await platformFlagEnabled(SELF_SERVE_SHOP_CREATION, true, supabase);
      return { ...fallback, open: enabled, remaining: enabled ? SELF_SERVE_SHOP_LIMIT : 0 };
    }
    return {
      open: Boolean(data.open),
      used: Number(data.used || 0),
      limit: Number(data.limit || SELF_SERVE_SHOP_LIMIT),
      remaining: Number(data.remaining || 0),
    };
  } catch {
    return fallback;
  }
}

export async function selfServeShopCreationEnabled(client?: SupabaseClient) {
  const portal = await selfServeShopPortal(client);
  return portal.open;
}
