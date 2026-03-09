import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { createSessionToken, sessionCookieOptions, ADMIN_SESSION_COOKIE } from "@/lib/admin/session";

export const runtime = "nodejs";

type LoginBody = {
  password?: unknown;
};

function unauthorized(message: string) {
  return NextResponse.json({ ok: false, message }, { status: 401 });
}

export async function POST(request: Request) {
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedPassword) {
    return NextResponse.json(
      { ok: false, message: "Server misconfigured: ADMIN_PASSWORD is not set." },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => null)) as LoginBody | null;
  const password = typeof body?.password === "string" ? body.password : "";

  const providedBuffer = Buffer.from(password);
  const expectedBuffer = Buffer.from(expectedPassword);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return unauthorized("Invalid password.");
  }

  const response = NextResponse.json({ ok: true, message: "Login successful." });
  response.cookies.set(ADMIN_SESSION_COOKIE, createSessionToken(), sessionCookieOptions());
  return response;
}

