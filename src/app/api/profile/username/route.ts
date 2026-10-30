import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiProfile } from "@/lib/auth/session";

export async function POST(request: Request) {
  const auth = await requireApiProfile();
  if (!auth.ok) return auth.error;
  const body = await request.json();
  const username = String(body.username || "");
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("change_username", {
    p_new_username: username,
  });
  if (error) return NextResponse.json({ error: "Unable to change username." }, { status: 400 });
  if (data?.ok === false) return NextResponse.json({ error: data.error, nextAllowedAt: data.next_allowed_at }, { status: 400 });
  return NextResponse.json(data);
}
