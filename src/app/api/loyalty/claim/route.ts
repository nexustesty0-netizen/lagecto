import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiProfile } from "@/lib/auth/session";

export async function POST(request: Request) {
  const auth = await requireApiProfile("customer");
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const rewardId = String(body.rewardId || "");
  if (!rewardId) return NextResponse.json({ error: "Missing reward." }, { status: 400 });
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("claim_reward", { p_reward_id: rewardId });
  if (error) return NextResponse.json({ error: "Unable to claim this reward." }, { status: 400 });
  if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json(data);
}
