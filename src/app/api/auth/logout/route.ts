import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

function isAuthCookie(name: string) {
  return name.startsWith("sb-") || name.includes("supabase") || name.includes("auth-token");
}

export async function POST() {
  const cookieStore = await cookies();
  const supabase = await createServerSupabase();
  await supabase.auth.signOut({ scope: "global" });

  const response = NextResponse.json({ ok: true });
  const expired = {
    path: "/",
    maxAge: 0,
    expires: new Date(0),
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
  try {
    for (const cookie of cookieStore.getAll()) {
      if (!isAuthCookie(cookie.name)) continue;
      cookieStore.set(cookie.name, "", expired);
      response.cookies.set(cookie.name, "", expired);
    }
  } catch {
    // Cookie mutation can fail in some runtimes; the sign-out above is the source of truth.
  }
  return response;
}
