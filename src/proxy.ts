import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getRole } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"];
// Private single-use links LPs open without an account (the token in the URL
// is the credential); the API routes behind them only touch that one request.
// /api/agent/ is for Claude on a member's PC: those routes check their own bearer token.
const PUBLIC_PREFIXES = ["/lp-request/", "/api/lp-requests/", "/api/agent/"];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response = NextResponse.next({ request });

  // Bound to this request/response pair so a refreshed session's cookies
  // make it back to the browser — required by @supabase/ssr's middleware
  // pattern (see https://supabase.com/docs/guides/auth/server-side/nextjs).
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    return response;
  }

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // An account created or reset with a temporary password must choose its own first.
  if (
    user.user_metadata?.must_change_password === true &&
    pathname !== "/account" &&
    !pathname.startsWith("/api/")
  ) {
    return NextResponse.redirect(new URL("/account?forced=1", request.url));
  }

  // Team members can't reach admin-only pages even by typing the URL.
  const isAddLp = /^\/cases\/[^/]+\/track\/new\/?$/.test(pathname);
  if (
    pathname.startsWith("/cases/new") ||
    pathname.startsWith("/users") ||
    isAddLp
  ) {
    const role = await getRole(supabase, user.id);
    if (role === "team") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  // apple-icon.png must stay public: iOS fetches it without the user's session
  // when adding the site to the Home Screen, and a login redirect breaks it.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|apple-icon).*)"],
};
