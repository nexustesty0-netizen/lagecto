import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { clientIp } from "@/lib/format";
import {
  GENERIC_REGISTER_ERROR,
  RATE_LIMIT_ERROR,
} from "@/lib/brand";
import {
  EMAIL_RE,
  USERNAME_RE,
  validateFullName,
  validatePassword,
  validatePhone,
} from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fullName = String(body.fullName || body.full_name || "").trim();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const phone = String(body.phone || "").trim();
    const ip = clientIp(request.headers);
    const ua = request.headers.get("user-agent") || "";
    const admin = createServiceSupabase();

    const allowed = await admin.rpc("check_auth_rate_limit", {
      p_bucket_key: `register:ip:${ip || "unknown"}`,
      p_max_hits: 8,
      p_window_seconds: 60 * 60,
    });
    if (allowed.data === false) {
      return NextResponse.json({ error: RATE_LIMIT_ERROR }, { status: 429 });
    }

    const nameError = validateFullName(fullName);
    if (nameError) return NextResponse.json({ error: nameError }, { status: 400 });
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
    if (!USERNAME_RE.test(username) && !(username.length === 3 && /^[a-z0-9]{3}$/i.test(username))) {
      return NextResponse.json(
        { error: "Username must be 3-24 characters using letters, numbers, dots or underscores." },
        { status: 400 },
      );
    }
    const phoneError = validatePhone(phone);
    if (phoneError) return NextResponse.json({ error: phoneError }, { status: 400 });
    const passwordError = validatePassword(password);
    if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

    const { data: takenEmail } = await admin.from("users").select("id").eq("email", email).maybeSingle();
    if (takenEmail) {
      return NextResponse.json({ error: GENERIC_REGISTER_ERROR }, { status: 400 });
    }
    const normalizedUsername = username.toLowerCase();
    const { data: takenUsername } = await admin
      .from("users")
      .select("id")
      .eq("username_normalized", normalizedUsername)
      .maybeSingle();
    if (takenUsername) {
      return NextResponse.json({ error: "This username is already taken." }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const signupRes = await fetch(`${url}/auth/v1/signup`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        data: { name: fullName, username, phone },
      }),
    });
    const created = await signupRes.json().catch(() => ({}));
    if (!signupRes.ok) {
      await admin.rpc("log_security_event", {
        p_event_type: "registration_failure",
        p_identifier: email,
        p_ip: ip,
        p_user_agent: ua,
        p_result: "failure",
        p_metadata: { reason: "signup_failed" },
      });
      return NextResponse.json({ error: GENERIC_REGISTER_ERROR }, { status: 400 });
    }

    await admin.rpc("log_security_event", {
      p_event_type: "registration_success",
      p_actor_id: created?.user?.id || null,
      p_target_user_id: created?.user?.id || null,
      p_identifier: username,
      p_ip: ip,
      p_user_agent: ua,
      p_result: "success",
      p_metadata: {},
    });

    return NextResponse.json({
      ok: true,
      needsEmailVerification: !created?.session,
      email,
    });
  } catch {
    return NextResponse.json({ error: GENERIC_REGISTER_ERROR }, { status: 400 });
  }
}
