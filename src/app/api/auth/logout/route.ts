import { NextResponse } from "next/server";
import { ROLE_COOKIE } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ROLE_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
