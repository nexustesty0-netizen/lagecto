import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { enquiryAllowed, parseStorefrontEnquiry } from "@/lib/storefront/enquiry";
import { notifyShop } from "@/lib/notify.server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createServerSupabase();
  const { data: shop } = await supabase
    .from("shops")
    .select("id, name, whatsapp_number, phone, status")
    .eq("id", id)
    .maybeSingle();
  if (!shop || shop.status !== "active") {
    return NextResponse.json({ error: "Shop not found." }, { status: 404 });
  }
  return NextResponse.json({
    shopId: shop.id,
    name: shop.name,
    whatsapp: shop.whatsapp_number || null,
    phone: shop.phone || null,
  });
}

function clientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!enquiryAllowed(`${id}:${clientKey(request)}`)) {
    return NextResponse.json({ error: "Please wait before sending another message." }, { status: 429 });
  }
  const parsed = parseStorefrontEnquiry(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const supabase = await createServerSupabase();
  const { data: shop } = await supabase.from("shops").select("id, name, status").eq("id", id).eq("status", "active").maybeSingle();
  if (!shop) return NextResponse.json({ error: "Shop not found." }, { status: 404 });

  const details = `From: ${parsed.name}\nEmail: ${parsed.email}\nPhone: ${parsed.phone}\n\n${parsed.message}`;
  const requestRow = {
    shop_id: shop.id,
    customer_name: parsed.name,
    title: parsed.subject,
    details,
    status: "open",
  };

  let admin = null as ReturnType<typeof createServiceSupabase> | null;
  try {
    admin = createServiceSupabase();
  } catch {
    admin = null;
  }

  if (admin) {
    let requestId: string | null = null;
    const inserted = await admin.from("service_requests").insert(requestRow).select("id").maybeSingle();
    if (inserted.error) {
      const { customer_name: _name, ...withoutName } = requestRow;
      const retry = await admin.from("service_requests").insert(withoutName).select("id").maybeSingle();
      if (retry.error) return NextResponse.json({ error: "Unable to send this message." }, { status: 400 });
      requestId = retry.data?.id || null;
    } else {
      requestId = inserted.data?.id || null;
    }
    await notifyShop(shop.id, {
      title: "New customer enquiry",
      message: `${parsed.name} sent you a message.`,
      type: "enquiry",
      referenceId: requestId,
      href: requestId ? `/shop/service-requests/${requestId}` : "/shop/service-requests",
    });
    return NextResponse.json({ ok: true });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to send a message, or contact the shop on WhatsApp." },
      { status: 401 },
    );
  }
  const inserted = await supabase.from("service_requests").insert({ ...requestRow, customer_id: user.id }).select("id").maybeSingle();
  if (inserted.error) return NextResponse.json({ error: "Unable to send this message." }, { status: 400 });
  await notifyShop(shop.id, {
    title: "New customer enquiry",
    message: `${parsed.name} sent you a message.`,
    type: "enquiry",
    referenceId: inserted.data?.id || null,
    href: inserted.data?.id ? `/shop/service-requests/${inserted.data.id}` : "/shop/service-requests",
  });
  return NextResponse.json({ ok: true });
}
