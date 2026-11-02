import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { requireApiProfile } from "@/lib/auth/session";

function isAuthCookie(name: string) {
  return name.startsWith("sb-") || name.includes("supabase") || name.includes("auth-token");
}

function expireAuthCookies(response: NextResponse, cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const expired = {
    path: "/",
    maxAge: 0,
    expires: new Date(0),
    httpOnly: true,
    sameSite: "lax" as const,
  };
  try {
    for (const cookie of cookieStore.getAll()) {
      if (!isAuthCookie(cookie.name)) continue;
      cookieStore.set(cookie.name, "", expired);
      response.cookies.set(cookie.name, "", expired);
    }
  } catch {
    // Cookie mutation can fail in some runtimes.
  }
}

export async function POST(request: Request) {
  const auth = await requireApiProfile();
  if (!auth.ok) return auth.error;
  if (auth.profile.role === "admin") {
    return NextResponse.json({ error: "Admin accounts cannot be self-deleted." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const reason = String(body.reason || "").trim();
  if (reason.length < 8) {
    return NextResponse.json({ error: "Please tell us why you are deleting this account." }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("self_delete_account", { p_reason: reason });
  const rpcMissing = Boolean(error && /could not find|does not exist|schema cache/i.test(error.message || ""));
  if (error && !rpcMissing) {
    return NextResponse.json({ error: "Unable to delete this account." }, { status: 400 });
  }
  if (data?.ok === false) {
    return NextResponse.json({ error: data.error || "Unable to delete this account." }, { status: 400 });
  }

  try {
    const admin = createServiceSupabase();
    await admin
      .from("shops")
      .update({ status: "inactive", is_open: false, updated_at: new Date().toISOString() })
      .or(`owner_user_id.eq.${auth.profile.id},owner_email.eq.${auth.profile.email}`);
    await admin.auth.admin.deleteUser(auth.profile.id);
  } catch {
    if (!data?.ok) {
      return NextResponse.json({ error: "Unable to delete this account right now." }, { status: 400 });
    }
  }

  const cookieStore = await cookies();
  await supabase.auth.signOut({ scope: "global" }).catch(() => undefined);
  const response = NextResponse.json({ ok: true });
  expireAuthCookies(response, cookieStore);
  return response;
}
