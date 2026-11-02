import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { applySecurityHeaders, authCookieOptions, isHttpsRequest } from "@/lib/security";
import { isNoindexPath } from "@/lib/seo-paths.mjs";

function isPrivatePath(pathname: string) {
  return (
    pathname.startsWith("/customer") ||
    pathname === "/shop" ||
    pathname.startsWith("/shop/") ||
    pathname.startsWith("/admin")
  );
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    if (isPrivatePath(pathname)) {
      const redirect = NextResponse.redirect(new URL("/login?setup=1", request.url));
      applySecurityHeaders(redirect.headers, { hsts: isHttpsRequest(request) });
      redirect.headers.set("X-Robots-Tag", "noindex, nofollow");
      return redirect;
    }
    applySecurityHeaders(response.headers, { hsts: isHttpsRequest(request) });
    return response;
  }

  const secure = isHttpsRequest(request);
  const cookieDefaults = authCookieOptions(secure);

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, {
            ...options,
            httpOnly: options?.httpOnly ?? cookieDefaults.httpOnly,
            sameSite: options?.sameSite ?? cookieDefaults.sameSite,
            secure: cookieDefaults.secure || Boolean(options?.secure),
            path: options?.path ?? cookieDefaults.path,
          });
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPrivate = isPrivatePath(pathname);

  if (isPrivate && !user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(login);
    applySecurityHeaders(redirect.headers, { hsts: secure });
    redirect.headers.set("X-Robots-Tag", "noindex, nofollow");
    return redirect;
  }

  if (user && pathname === "/signup" && !request.nextUrl.searchParams.has("logged_out")) {
    const redirect = NextResponse.redirect(new URL("/app", request.url));
    applySecurityHeaders(redirect.headers, { hsts: secure });
    return redirect;
  }

  applySecurityHeaders(response.headers, { hsts: secure });
  if (isNoindexPath(pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  const requestId = request.headers.get("x-request-id")?.trim();
  if (requestId && requestId.length <= 80 && /^[A-Za-z0-9._-]+$/.test(requestId)) {
    response.headers.set("x-request-id", requestId);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
