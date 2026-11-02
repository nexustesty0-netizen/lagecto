import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiProfile } from "@/lib/auth/session";
import { jsonError } from "@/lib/api-error";
import { validatePassword } from "@/lib/validation";

export async function POST(request: Request) {
  const auth = await requireApiProfile();
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const current = String(body.currentPassword || "");
  const next = String(body.newPassword || "");
  if (!current) return NextResponse.json({ error: "Enter your current password." }, { status: 400 });
  const nextError = validatePassword(next);
  if (nextError) return NextResponse.json({ error: nextError }, { status: 400 });
  if (current === next) return NextResponse.json({ error: "Choose a different password." }, { status: 400 });

  const supabase = await createServerSupabase();
  const email = auth.profile.email;
  if (!email) return jsonError("account.password", "Unable to update password.", 400);
  const check = await supabase.auth.signInWithPassword({ email, password: current });
  if (check.error) return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return jsonError("account.password", "Unable to update password.", 400, error);
  return NextResponse.json({ ok: true });
}
