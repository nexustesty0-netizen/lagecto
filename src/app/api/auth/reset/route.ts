import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { clientIp, siteUrl } from "@/lib/format";
import { RATE_LIMIT_ERROR } from "@/lib/brand";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const identifier = String(body.identifier || body.email || "").trim();
    const ip = clientIp(request.headers);
    const ua = request.headers.get("user-agent") || "";
    const admin = createServiceSupabase();

    const allowed = await admin.rpc("check_auth_rate_limit", {
      p_bucket_key: `reset:ip:${ip || "unknown"}`,
      p_max_hits: 8,
      p_window_seconds: 60 * 60,
    });
    if (allowed.data === false) {
      return NextResponse.json({ error: RATE_LIMIT_ERROR }, { status: 429 });
    }

    if (identifier) {
      const { data: identities } = await admin.rpc("resolve_login_identity", {
        p_identifier: identifier,
      });
      const identity = Array.isArray(identities) ? identities[0] : identities;
      if (identity?.auth_email && identity?.account_status === "active") {
        await admin.auth.resetPasswordForEmail(identity.auth_email, {
          redirectTo: `${siteUrl()}/login`,
        });
        await admin.rpc("log_security_event", {
          p_event_type: "password_reset_requested",
          p_target_user_id: identity.user_id,
          p_identifier: identifier,
          p_ip: ip,
          p_user_agent: ua,
          p_result: "success",
          p_metadata: { login_method: identity.login_method },
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
