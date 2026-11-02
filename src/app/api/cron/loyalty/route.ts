import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { logEvent } from "@/lib/safe-log";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const left = Buffer.from(bearer);
  const right = Buffer.from(secret);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const admin = createServiceSupabase();
  const [{ data: news, error: newsError }, { data: founding, error: foundingError }, { data: subscriptions, error: subError }] =
    await Promise.all([
      admin.rpc("publish_due_news"),
      admin.rpc("expire_founding_campaigns"),
      admin.rpc("expire_due_subscriptions", { p_shop_id: null }),
    ]);
  if (newsError || foundingError || subError) {
    logEvent("error", "cron.loyalty", { error: newsError || foundingError || subError });
    return NextResponse.json({ ok: false, status: "degraded" }, { status: 500 });
  }
  logEvent("info", "cron.loyalty", { message: "completed" });
  return NextResponse.json({
    ok: true,
    published_news: news || 0,
    expired_enrollments: founding || 0,
    expired_subscriptions: subscriptions || 0,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
