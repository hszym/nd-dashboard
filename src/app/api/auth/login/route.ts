import { NextRequest, NextResponse } from "next/server";
import { ROLE_COOKIE, Role } from "@/lib/auth";

export async function POST(request: NextRequest) {
  let password: string | undefined;
  try {
    const body = await request.json();
    password = body?.password;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  let role: Role | null = null;
  if (password && process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) {
    role = "admin";
  } else if (password && process.env.TEAM_PASSWORD && password === process.env.TEAM_PASSWORD) {
    role = "team";
  }

  if (!role) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const response = NextResponse.json({ role });
  response.cookies.set(ROLE_COOKIE, role, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return response;
}
