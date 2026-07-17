import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

/**
 * Middleware — runs on every matching request.
 *
 * Responsibilities:
 * 1. Refresh Supabase auth session (keeps JWT fresh)
 * 2. Redirect unauthenticated users from protected routes to login
 * 3. Redirect authenticated users away from auth pages
 *
 * Auth pages (public): /login (passwordless email OTP), /register (redirects
 * to /login), plus the /auth/* callback routes.
 * Protected prefix: everything else under /(app)/...
 *
 * NOTE: We use process.env directly in middleware (cannot import from @/config/env)
 * because middleware runs at the Edge Runtime which has module execution restrictions.
 */
export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Guard: if env vars are missing, skip auth logic and continue
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          supabaseResponse.cookies.set(name, value, options as any)
        );
      },
    },
  });

  // Refresh the session — IMPORTANT: do not remove getUser() call
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Supabase sends the email-confirmation / magic-link redirect to the Site URL
  // (often the root "/") with a PKCE ?code=. Forward it to the callback route
  // that exchanges the code for a session — otherwise it lands on a dead page.
  if (pathname === "/" && request.nextUrl.searchParams.has("code")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  // Public auth routes
  const isAuthRoute = [
    "/login",
    "/register",
    "/auth/callback",
    "/auth/confirm",
  ].some((route) => pathname.startsWith(route));

  // Redirect unauthenticated users to login (protect app routes)
  if (!user && !isAuthRoute && pathname !== "/") {
    // Preserve the full path incl. query (e.g. the invitation ?token=…) so the
    // user lands back on the exact page after signing in.
    const redirectTo = `${pathname}${request.nextUrl.search}`;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = ""; // drop the original query so it doesn't leak onto /login
    url.searchParams.set("redirectTo", redirectTo);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - Public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
