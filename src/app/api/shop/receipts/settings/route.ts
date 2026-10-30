import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiShop } from "@/lib/auth/session";
import { contrastRatio, isHexColor, normalizeHex } from "@/lib/storefront/theme";
import { isReceiptTemplate, RECEIPT_HEADER_LAYOUTS, RECEIPT_SIZES } from "@/lib/receipts";

export async function POST(request: Request) {
  const auth = await requireApiShop();
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const template = isReceiptTemplate(body.template) ? body.template : "classic";
  const primary = isHexColor(body.primary) ? normalizeHex(body.primary) : "#0B6E4F";
  const secondary = isHexColor(body.secondary) ? normalizeHex(body.secondary) : "#2E8B57";
  const accent = isHexColor(body.accent) ? normalizeHex(body.accent) : "#D4AF37";
  const background = isHexColor(body.background) ? normalizeHex(body.background) : "#FFFDF8";
  const headerLayout = RECEIPT_HEADER_LAYOUTS.includes(String(body.headerLayout) as (typeof RECEIPT_HEADER_LAYOUTS)[number])
    ? (body.headerLayout as (typeof RECEIPT_HEADER_LAYOUTS)[number])
    : "centered";
  const size = RECEIPT_SIZES.includes(String(body.size) as (typeof RECEIPT_SIZES)[number])
    ? (body.size as (typeof RECEIPT_SIZES)[number])
    : "a4";
  const contrast = contrastRatio("#12241C", background);
  const customization = {
    template,
    primary,
    secondary,
    accent,
    background,
    headerLayout,
    size,
    header: String(body.header || "").slice(0, 160),
    footerMessage: String(body.footerMessage || "").slice(0, 200),
    showLogo: body.showLogo !== false,
    showContact: body.showContact !== false,
    contrastRatio: Number(contrast.toFixed(2)),
  };
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("shops")
    .update({
      receipt_template: template,
      receipt_header: customization.header,
      receipt_footer: customization.footerMessage,
      receipt_customization: customization,
    })
    .eq("id", auth.shop.id);
  if (error) return NextResponse.json({ error: "Unable to save receipt design." }, { status: 400 });
  await supabase.rpc("log_security_event", {
    p_event_type: "shop_receipt_design",
    p_actor_id: auth.profile.id,
    p_target_shop_id: auth.shop.id,
    p_result: "success",
    p_metadata: { template, size },
  });
  return NextResponse.json({ ok: true, warning: contrast < 4.5 ? "low_contrast" : null });
}
