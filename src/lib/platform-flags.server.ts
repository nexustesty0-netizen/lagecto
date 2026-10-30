import { createServerSupabase } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SELF_SERVE_SHOP_CREATION } from "@/lib/platform-flags";

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

export async function selfServeShopCreationEnabled(client?: SupabaseClient) {
  return platformFlagEnabled(SELF_SERVE_SHOP_CREATION, true, client);
}
