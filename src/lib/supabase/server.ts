import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicSupabaseConfig } from "@/lib/env";
import { authCookieOptions } from "@/lib/security";

export async function createServerSupabase() {
  const cookieStore = await cookies();
  const { url, anonKey } = getPublicSupabaseConfig();
  const secure = process.env.NODE_ENV === "production";
  const cookieDefaults = authCookieOptions(secure);

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, {
              ...options,
              httpOnly: options?.httpOnly ?? cookieDefaults.httpOnly,
              sameSite: options?.sameSite ?? cookieDefaults.sameSite,
              secure: cookieDefaults.secure || Boolean(options?.secure),
              path: options?.path ?? cookieDefaults.path,
            });
          });
        } catch {
          // Called from a Server Component; proxy handles refresh.
        }
      },
    },
  });
}
