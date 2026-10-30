import type { SupabaseClient } from "@supabase/supabase-js";

type ShopRow = {
  id?: string;
  login_shop_id?: string | null;
  name?: string | null;
};

export type SelfServeShopInput = {
  userId: string;
  shopName: string;
  providerType: string;
  category: string;
  phone: string;
  about: string | null;
  email: string;
  contactName: string;
};

export type SelfServeShopResult =
  | { ok: true; login_shop_id: string; shop_name: string }
  | { ok: false; error: string; keepUser?: boolean };

function asShop(data: unknown): ShopRow | null {
  if (!data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  return row as ShopRow;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPublicUser(admin: SupabaseClient, userId: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data } = await admin.from("users").select("id").eq("id", userId).maybeSingle();
    if (data?.id) return true;
    await sleep(150);
  }
  return false;
}

async function ensurePublicUser(admin: SupabaseClient, input: SelfServeShopInput) {
  if (await waitForPublicUser(admin, input.userId)) return true;
  const { error } = await admin.from("users").insert({
    id: input.userId,
    email: input.email,
    name: input.contactName,
    phone: input.phone,
    role: "customer",
  });
  if (error && !/duplicate|already exists|23505/i.test(error.message)) {
    console.error("self-serve insert user", error);
    return false;
  }
  await admin.from("user_settings").insert({ user_id: input.userId });
  return waitForPublicUser(admin, input.userId);
}

async function loadOwnedShop(admin: SupabaseClient, userId: string, email: string) {
  const byOwner = await admin
    .from("shops")
    .select("id, login_shop_id, name")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (byOwner.data?.login_shop_id) return byOwner.data;
  const byEmail = await admin
    .from("shops")
    .select("id, login_shop_id, name")
    .ilike("owner_email", email)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return byEmail.data;
}

async function finishShop(admin: SupabaseClient, shop: ShopRow, input: SelfServeShopInput) {
  if (!shop.id) return;
  await admin
    .from("shops")
    .update({
      phone: input.phone,
      whatsapp_number: input.phone,
      about: input.about,
      email: input.email,
      category: input.category,
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", shop.id);
  await admin
    .from("users")
    .update({
      name: input.contactName,
      phone: input.phone,
    })
    .eq("id", input.userId);
}

export async function provisionSelfServeShop(
  admin: SupabaseClient,
  input: SelfServeShopInput,
): Promise<SelfServeShopResult> {
  const rpc = await admin.rpc("self_serve_create_shop", {
    p_user_id: input.userId,
    p_shop_name: input.shopName,
    p_provider_type: input.providerType,
    p_category: input.category,
    p_phone: input.phone,
    p_about: input.about,
    p_email: input.email,
  });

  if (!rpc.error && rpc.data?.ok && rpc.data.login_shop_id) {
    return {
      ok: true,
      login_shop_id: String(rpc.data.login_shop_id),
      shop_name: String(rpc.data.shop_name || input.shopName),
    };
  }

  if (!rpc.error && rpc.data?.login_shop_id) {
    return {
      ok: true,
      login_shop_id: String(rpc.data.login_shop_id),
      shop_name: String(rpc.data.shop_name || input.shopName),
    };
  }

  if (rpc.error) {
    console.error("self_serve_create_shop", rpc.error.message || rpc.error);
  } else if (rpc.data?.ok === false && rpc.data?.error) {
    if (/turned off|not authorized|admin accounts/i.test(String(rpc.data.error))) {
      return { ok: false, error: String(rpc.data.error) };
    }
  }

  if (!(await ensurePublicUser(admin, input))) {
    return { ok: false, error: "Unable to create this shop profile." };
  }

  const role = await admin.rpc("force_user_role", {
    p_user_id: input.userId,
    p_role: "shop_owner",
  });
  if (role.error) {
    console.error("force_user_role", role.error.message || role.error);
  }

  const shopRpc = await admin.rpc("ensure_shop_for_owner", {
    p_user_id: input.userId,
    p_shop_id: null,
    p_shop_name: input.shopName,
    p_provider_type: input.providerType,
    p_category: input.category,
  });

  let shop = asShop(shopRpc.data);
  if (shopRpc.error || !shop?.login_shop_id) {
    if (shopRpc.error) console.error("ensure_shop_for_owner", shopRpc.error.message || shopRpc.error);
    shop = (await loadOwnedShop(admin, input.userId, input.email)) || shop;
  }

  if (!shop?.login_shop_id) {
    return { ok: false, error: "Unable to create this shop right now." };
  }

  await finishShop(admin, shop, input);
  return {
    ok: true,
    login_shop_id: String(shop.login_shop_id),
    shop_name: String(shop.name || input.shopName),
  };
}
