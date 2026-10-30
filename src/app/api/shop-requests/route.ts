import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { clientIp } from "@/lib/format";
import { SHOP_CATEGORIES, SHOP_PROVIDER_TYPES } from "@/lib/brand";
import { selfServeShopCreationEnabled } from "@/lib/platform-flags.server";
import { provisionSelfServeShop } from "@/lib/shop/self-serve-create";
import { EMAIL_RE, validateFullName, validatePassword, validatePhone } from "@/lib/validation";

const CATEGORIES = new Set<string>(SHOP_CATEGORIES.map((item) => item.slug));
const PROVIDERS = new Set<string>(SHOP_PROVIDER_TYPES.map((item) => item.value));

function makeRef() {
  const raw = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `LG-${raw}`;
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function safeRef(value: string) {
  return value.replace(/[^A-Za-z0-9-]/g, "").slice(0, 40);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ref = safeRef(String(searchParams.get("ref") || "").trim());
  const phone = String(searchParams.get("phone") || "").trim();
  if (!ref || !phone) {
    return NextResponse.json({ error: "Enter your request reference and phone number." }, { status: 400 });
  }

  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.rpc("lookup_shop_registration", {
      p_ref: ref,
      p_phone: phone,
    });
    if (!error && data) {
      if (data.ok === false) return NextResponse.json({ error: data.error || "Request not found." }, { status: 404 });
      return NextResponse.json(data);
    }
  } catch {
    // Fall through to service-role lookup if the RPC is not applied yet.
  }

  try {
    const admin = createServiceSupabase();
    const phoneDigits = digits(phone);
    const { data: byRef } = await admin
      .from("shop_registration_requests")
      .select("public_ref, shop_name, status, admin_notes, created_at, phone")
      .ilike("public_ref", ref)
      .limit(5);
    const match = (byRef || []).find((row) => digits(String(row.phone || "")) === phoneDigits);
    if (!match) return NextResponse.json({ error: "Request not found." }, { status: 404 });
    return NextResponse.json({
      ok: true,
      ref: match.public_ref,
      shop_name: match.shop_name,
      status: match.status,
      admin_notes: match.admin_notes,
      created_at: match.created_at,
    });
  } catch {
    return NextResponse.json({ error: "Unable to look up this request." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const contactName = String(body.contact_name || "").trim();
  const shopName = String(body.shop_name || "").trim();
  const phone = String(body.phone || "").trim();
  const email = String(body.email || "").trim();
  const about = String(body.about || "").trim();
  const category = CATEGORIES.has(String(body.category)) ? String(body.category) : "other";
  const providerType = PROVIDERS.has(String(body.provider_type)) ? String(body.provider_type) : "both";

  if (!contactName || !shopName || !phone) {
    return NextResponse.json({ error: "Name, shop name, and phone are required." }, { status: 400 });
  }

  try {
    const admin = createServiceSupabase();
    const ip = clientIp(request.headers);
    const allowed = await admin.rpc("check_auth_rate_limit", {
      p_bucket_key: `shop-reg:${ip || "unknown"}`,
      p_max_hits: 8,
      p_window_seconds: 60 * 60,
    });
    if (allowed.data === false) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    if (await selfServeShopCreationEnabled(admin)) {
      const password = String(body.password || "");
      const nameError = validateFullName(contactName);
      if (nameError) return NextResponse.json({ error: nameError }, { status: 400 });
      const phoneError = validatePhone(phone);
      if (phoneError) return NextResponse.json({ error: phoneError }, { status: 400 });
      const normalizedEmail = email.toLowerCase();
      if (!EMAIL_RE.test(normalizedEmail)) {
        return NextResponse.json({ error: "Email is required so we can create your shop login." }, { status: 400 });
      }
      const passwordError = validatePassword(password);
      if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

      const { data: takenEmail } = await admin.from("users").select("id, role").ilike("email", normalizedEmail).maybeSingle();
      if (takenEmail) {
        return NextResponse.json(
          { error: "This email already has an account. Sign in, or use another email to open a shop." },
          { status: 400 },
        );
      }

      const created = await admin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { name: contactName, phone },
      });
      if (created.error || !created.data.user) {
        const already = /already|registered|exists/i.test(created.error?.message || "");
        return NextResponse.json(
          {
            error: already
              ? "This email already has an account. Sign in, or use another email to open a shop."
              : "Unable to create this shop account.",
          },
          { status: 400 },
        );
      }

      const provisioned = await provisionSelfServeShop(admin, {
        userId: created.data.user.id,
        shopName,
        providerType,
        category,
        phone,
        about: about || null,
        email: normalizedEmail,
        contactName,
      });
      if (!provisioned.ok) {
        if (!provisioned.keepUser) {
          await admin.auth.admin.deleteUser(created.data.user.id).catch(() => undefined);
        }
        return NextResponse.json({ error: provisioned.error }, { status: 400 });
      }

      return NextResponse.json({
        ok: true,
        created: true,
        login_shop_id: provisioned.login_shop_id,
        shop_name: provisioned.shop_name,
      });
    }

    const server = await createServerSupabase();
    const {
      data: { user },
    } = await server.auth.getUser();

    const payload: Record<string, unknown> = {
      requester_user_id: user?.id || null,
      contact_name: contactName,
      shop_name: shopName,
      category,
      phone,
      email: email || null,
      about: about || null,
      provider_type: providerType,
      status: "pending",
    };

    let inserted: { public_ref?: string | null; id: string } | null = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const publicRef = makeRef();
      const { data, error } = await admin
        .from("shop_registration_requests")
        .insert({ ...payload, public_ref: publicRef })
        .select("id, public_ref")
        .single();
      if (!error && data) {
        inserted = data;
        break;
      }
      if (error?.message?.includes("public_ref") || error?.code === "42703") {
        const fallback = await admin.from("shop_registration_requests").insert(payload).select("id").single();
        if (fallback.error || !fallback.data) {
          return NextResponse.json({ error: "Unable to submit this request." }, { status: 400 });
        }
        inserted = { id: fallback.data.id, public_ref: fallback.data.id.slice(0, 8).toUpperCase() };
        break;
      }
    }

    if (!inserted) return NextResponse.json({ error: "Unable to submit this request." }, { status: 400 });
    return NextResponse.json({
      ok: true,
      ref: inserted.public_ref || inserted.id.slice(0, 8).toUpperCase(),
    });
  } catch {
    return NextResponse.json({ error: "Unable to submit this request right now." }, { status: 400 });
  }
}
