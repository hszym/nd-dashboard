import { NextRequest, NextResponse } from "next/server";
import { ROLE_COOKIE, isValidRole } from "@/lib/auth";

const PUBLIC_PATHS = ["/login"];
const PUBLIC_API_PATHS = ["/api/auth/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_API_PATHS.includes(pathname)
  ) {
    return NextResponse.next();
  }

  const role = request.cookies.get(ROLE_COOKIE)?.value;

  if (!isValidRole(role)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Team members can't reach the case-creation form even by typing the URL.
  if (role === "team" && pathname.startsWith("/cases/new")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
