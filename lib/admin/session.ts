import crypto from "node:crypto";

export const ADMIN_SESSION_COOKIE = "admin_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 12;

type SessionPayload = {
  exp: number;
};

function sessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "";
}

function sign(value: string): string {
  return crypto.createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function createSessionToken(): string {
  const payload: SessionPayload = {
    exp: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
  };
  const encodedPayload = encode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token || !sessionSecret()) {
    return false;
  }

  const [encodedPayload, sentSignature] = token.split(".");
  if (!encodedPayload || !sentSignature) {
    return false;
  }

  try {
    const expectedSignature = sign(encodedPayload);
    const expectedBuffer = Buffer.from(expectedSignature);
    const sentBuffer = Buffer.from(sentSignature);

    if (
      expectedBuffer.length !== sentBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, sentBuffer)
    ) {
      return false;
    }

    const payload = JSON.parse(decode(encodedPayload)) as SessionPayload;
    return Boolean(payload.exp && payload.exp >= Math.floor(Date.now() / 1000));
  } catch {
    return false;
  }
}

export function getSessionTokenFromCookieHeader(cookieHeader: string | null): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  const rawCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_SESSION_COOKIE}=`));

  if (!rawCookie) {
    return undefined;
  }

  return decodeURIComponent(rawCookie.slice(ADMIN_SESSION_COOKIE.length + 1));
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  };
}
