import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  ADMIN_COOKIE_NAME,
  createAdminSessionValue,
  isValidAdminPassword,
  isValidAdminSession,
} from "@/shared/lib/admin/session";

export async function GET() {
  const cookieStore = await cookies();
  return NextResponse.json({
    authenticated: isValidAdminSession(cookieStore.get(ADMIN_COOKIE_NAME)?.value),
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { password?: string };

  if (!body.password || !isValidAdminPassword(body.password)) {
    return NextResponse.json({ error: "invalid_password" }, { status: 401 });
  }

  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(ADMIN_COOKIE_NAME, createAdminSessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
