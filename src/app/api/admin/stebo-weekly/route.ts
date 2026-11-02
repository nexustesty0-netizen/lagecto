import { NextResponse } from "next/server";
import { requireApiAdminLevel } from "@/lib/auth/session";
import { createServiceSupabase } from "@/lib/supabase/service";

export async function POST() {
  const auth = await requireApiAdminLevel("admin");
  if (!auth.ok) return auth.error;
  const admin = createServiceSupabase();
  const { data, error } = await admin.rpc("generate_stebo_weekly_reports");
  if (error) return NextResponse.json({ error: "Unable to generate weekly reports." }, { status: 500 });
  return NextResponse.json(data);
}
