import { NextResponse } from "next/server";

import { getSessionTokenFromCookieHeader, verifySessionToken } from "@/lib/admin/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const isAuthenticated = verifySessionToken(getSessionTokenFromCookieHeader(request.headers.get("cookie")));
  return NextResponse.json({ ok: true, authenticated: isAuthenticated });
}
