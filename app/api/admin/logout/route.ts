import { NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE, sessionCookieOptions } from "@/lib/admin/session";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true, message: "Logged out." });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}

