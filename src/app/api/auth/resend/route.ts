import { NextResponse } from "next/server";
import { RATE_LIMIT_ERROR } from "@/lib/brand";
import { clientIp } from "@/lib/format";
import { getPublicSupabaseConfig } from "@/lib/env";
import { createServiceSupabase } from "@/lib/supabase/service";
import { EMAIL_RE } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const ip = clientIp(request.headers);
    const admin = createServiceSupabase();
    const allowed = await admin.rpc("check_auth_rate_limit", {
      p_bucket_key: `resend:${ip || "unknown"}:${email || "none"}`,
      p_max_hits: 5,
      p_window_seconds: 15 * 60,
    });
    if (allowed.data === false) {
      return NextResponse.json({ error: RATE_LIMIT_ERROR }, { status: 429 });
    }
    if (!EMAIL_RE.test(email)) return NextResponse.json({ ok: true });
    const { url, anonKey } = getPublicSupabaseConfig();
    await fetch(`${url}/auth/v1/resend`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "signup", email }),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
