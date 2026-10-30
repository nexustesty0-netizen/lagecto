import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { requireApiProfile } from "@/lib/auth/session";
import { validateSniffedUpload, validateUpload, extensionOf, safeFileStem } from "@/lib/media";

export async function POST(request: Request) {
  const auth = await requireApiProfile();
  if (!auth.ok) return auth.error;
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Missing form." }, { status: 400 });

  const kind = String(form.get("kind") || "support");
  const details: Record<string, string> = {};
  const trying = String(form.get("trying") || "").trim();
  const ua = String(form.get("user_agent") || "").slice(0, 180);
  if (trying) details.trying = trying.slice(0, 1000);
  if (ua) details.user_agent = ua;

  const attachments: { path: string; mime: string }[] = [];
  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    const sizeCheck = validateUpload(file, "image");
    if (!sizeCheck.ok) return NextResponse.json({ error: sizeCheck.error }, { status: 400 });
    const buffer = new Uint8Array(await file.arrayBuffer());
    const sniffed = validateSniffedUpload(buffer, file.type, "image");
    if (!sniffed.ok) return NextResponse.json({ error: sniffed.error }, { status: 400 });
    const ext = sniffed.mime === "image/jpeg" ? "jpg" : sniffed.mime.split("/")[1] || extensionOf(file.name) || "bin";
    const path = `${auth.profile.id}/${safeFileStem()}.${ext}`;
    const admin = createServiceSupabase();
    const { error } = await admin.storage.from("support-uploads").upload(path, buffer, {
      contentType: sniffed.mime,
      upsert: false,
    });
    if (error) return NextResponse.json({ error: "Unable to store this image." }, { status: 400 });
    attachments.push({ path, mime: sniffed.mime });
  }

  let shopId = String(form.get("shop_id") || "").trim();
  if (shopId && !/^[0-9a-f-]{36}$/i.test(shopId)) {
    const supabase = await createServerSupabase();
    const { data: shop } = await supabase.from("shops").select("id").eq("slug", shopId).maybeSingle();
    shopId = shop?.id || "";
    if (!shopId) return NextResponse.json({ error: "We could not find that shop." }, { status: 400 });
  }

  const payload = {
    kind,
    category: String(form.get("category") || (kind === "bug" ? "bug" : kind === "technical" ? "technical" : "other")),
    subject: String(form.get("subject") || (kind === "bug" ? "Bug report" : "Support request")),
    description: String(form.get("description") || ""),
    priority: String(form.get("priority") || "normal"),
    severity: String(form.get("severity") || ""),
    area: String(form.get("area") || ""),
    steps_to_reproduce: String(form.get("steps_to_reproduce") || ""),
    rating: String(form.get("rating") || ""),
    shop_id: shopId || null,
    order_number: String(form.get("order_number") || ""),
    details,
    attachments,
  };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("create_support_case", { p_payload: payload });
  if (error) return NextResponse.json({ error: "Unable to submit this request." }, { status: 400 });
  if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json(data);
}
