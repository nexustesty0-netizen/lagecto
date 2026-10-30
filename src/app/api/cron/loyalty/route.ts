import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/service";

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
  const [{ data: news }, { data: founding }] = await Promise.all([
    admin.rpc("publish_due_news"),
    admin.rpc("expire_founding_campaigns"),
  ]);
  return NextResponse.json({ ok: true, published_news: news || 0, expired_enrollments: founding || 0 });
}

export async function POST(request: Request) {
  return GET(request);
}
