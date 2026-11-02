import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiProfile } from "@/lib/auth/session";
import { jsonError } from "@/lib/api-error";
import { asCartUuid, cartPayload, normalizeCartQty } from "@/lib/cart-math";

function mapSavedItems(rows: unknown): Array<{
  productId: string;
  shopId: string;
  shopName: string;
  name: string;
  price: number;
  quantity: number;
  image: string | null;
  type: "product" | "service";
  availability: "available" | "on_order";
}> {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const item = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
      const productId = asCartUuid(item.product_id);
      const shopId = asCartUuid(item.shop_id);
      const quantity = normalizeCartQty(item.quantity);
      if (!productId || !shopId || !quantity) return null;
      return {
        productId,
        shopId,
        shopName: String(item.shop_name || "Shop").slice(0, 80),
        name: String(item.name || "Product").slice(0, 160),
        price: Math.max(0, Number(item.price) || 0),
        quantity,
        image: typeof item.image === "string" ? item.image : null,
        type: item.type === "service" ? ("service" as const) : ("product" as const),
        availability: item.availability === "on_order" ? ("on_order" as const) : ("available" as const),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
}

export async function GET() {
  const auth = await requireApiProfile("customer");
  if (!auth.ok) return auth.error;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("load_customer_cart");
  if (error) return jsonError("cart.load", "Unable to load your cart.", 400, error);
  if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json({ ok: true, items: mapSavedItems(data?.items) });
}

export async function PUT(request: Request) {
  const auth = await requireApiProfile("customer");
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const items = cartPayload(
    (Array.isArray(body.items) ? body.items : []).map((item: { productId?: string; product_id?: string; quantity?: number }) => ({
      productId: item.productId || item.product_id || "",
      shopId: "",
      shopName: "",
      name: "",
      price: 0,
      quantity: Number(item.quantity || 0),
    })),
  );
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("sync_customer_cart", { p_items: items });
  if (error) return jsonError("cart.save", "Unable to save your cart.", 400, error);
  if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json({ ok: true, items: mapSavedItems(data?.items) });
}
