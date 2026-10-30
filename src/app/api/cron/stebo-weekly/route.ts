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
  const { data, error } = await admin.rpc("generate_stebo_weekly_reports");
  if (error) return NextResponse.json({ error: "Unable to generate weekly reports." }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  return GET(request);
}
