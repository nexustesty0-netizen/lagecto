import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { clientIp } from "@/lib/format";
import {
  ACCOUNT_LOCKED_ERROR,
  GENERIC_AUTH_ERROR,
  RATE_LIMIT_ERROR,
} from "@/lib/brand";

type Identity = {
  user_id: string;
  auth_email: string;
  account_role: "customer" | "shop_owner" | "admin";
  account_status: string;
  login_method: "email" | "username" | "shop_id";
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const identifier = String(body.identifier || "").trim();
    const password = String(body.password || "");
    if (!identifier || !password) {
      return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    }

    const ip = clientIp(request.headers);
    const ua = request.headers.get("user-agent") || "";
    const admin = createServiceSupabase();

    const ipOk = await admin.rpc("check_auth_rate_limit", {
      p_bucket_key: `login:ip:${ip || "unknown"}`,
      p_max_hits: 20,
      p_window_seconds: 15 * 60,
    });
    const idOk = await admin.rpc("check_auth_rate_limit", {
      p_bucket_key: `login:id:${identifier.toLowerCase()}`,
      p_max_hits: 10,
      p_window_seconds: 15 * 60,
    });
    if (ipOk.data === false || idOk.data === false) {
      return NextResponse.json({ error: RATE_LIMIT_ERROR }, { status: 429 });
    }

    const { data: identities } = await admin.rpc("resolve_login_identity", {
      p_identifier: identifier,
    });
    const identity = (Array.isArray(identities) ? identities[0] : identities) as
      | Identity
      | undefined;

    if (!identity?.user_id || !identity?.auth_email) {
      await admin.rpc("record_login_failure", {
        p_identifier: identifier,
        p_user_id: null,
        p_ip: ip,
        p_user_agent: ua,
      });
      return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    }

    if (identity.account_status && identity.account_status !== "active") {
      return NextResponse.json(
        { error: ACCOUNT_LOCKED_ERROR, locked: true },
        { status: 403 },
      );
    }

    if (identity.account_role === "shop_owner" && identity.login_method !== "shop_id") {
      await admin.rpc("record_login_failure", {
        p_identifier: identifier,
        p_user_id: identity.user_id,
        p_ip: ip,
        p_user_agent: ua,
      });
      return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    }

    if (identity.account_role !== "shop_owner" && identity.login_method === "shop_id") {
      await admin.rpc("record_login_failure", {
        p_identifier: identifier,
        p_user_id: identity.user_id,
        p_ip: ip,
        p_user_agent: ua,
      });
      return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    }

    const { url, anonKey } = {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    };

    const tokenRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: identity.auth_email, password }),
    });
    const tokenJson = await tokenRes.json().catch(() => ({}));

    if (!tokenRes.ok || !tokenJson.access_token) {
      const failure = await admin.rpc("record_login_failure", {
        p_identifier: identifier,
        p_user_id: identity.user_id,
        p_ip: ip,
        p_user_agent: ua,
      });
      const locked = failure.data?.locked === true;
      if (locked) {
        return NextResponse.json(
          { error: ACCOUNT_LOCKED_ERROR, locked: true },
          { status: 403 },
        );
      }
      return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    }

    await admin.rpc("record_login_success", {
      p_user_id: identity.user_id,
      p_identifier: identifier,
      p_ip: ip,
      p_user_agent: ua,
      p_login_method: identity.login_method,
    });

    const supabase = await createServerSupabase();
    await supabase.auth.signOut({ scope: "local" });
    const { error } = await supabase.auth.setSession({
      access_token: tokenJson.access_token,
      refresh_token: tokenJson.refresh_token,
    });
    if (error) {
      return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    }

    let home =
      identity.account_role === "admin"
        ? "/admin"
        : identity.account_role === "shop_owner"
          ? "/shop"
          : "/customer";
    if (home === "/customer") {
      const staff = await admin
        .from("shop_staff_assignments")
        .select("role_name")
        .eq("user_id", identity.user_id)
        .limit(1)
        .maybeSingle();
      if (staff.data?.role_name) home = staff.data.role_name === "cashier" ? "/shop/pos" : "/shop";
    }

    return NextResponse.json({
      ok: true,
      role: identity.account_role,
      redirectTo: home,
    });
  } catch {
    return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
  }
}
