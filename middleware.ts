import { NextRequest, NextResponse } from "next/server";

function unauthorizedResponse(): NextResponse {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="ChatGPT Screenshot Gallery Admin", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}

function parseBasicAuthHeader(headerValue: string | null): { user: string; password: string } | null {
  if (!headerValue || !headerValue.startsWith("Basic ")) {
    return null;
  }

  const encoded = headerValue.slice(6).trim();
  if (!encoded) {
    return null;
  }

  try {
    const decoded = atob(encoded);
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex < 0) {
      return null;
    }

    return {
      user: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest): NextResponse {
  const requiredUser = process.env.ADMIN_BASIC_USER;
  const requiredPassword = process.env.ADMIN_BASIC_PASSWORD;

  // Optional hardening: when unset, /admin works as usual (Identity-only auth).
  if (!requiredUser || !requiredPassword) {
    return NextResponse.next();
  }

  const credentials = parseBasicAuthHeader(request.headers.get("authorization"));
  if (!credentials) {
    return unauthorizedResponse();
  }

  if (credentials.user !== requiredUser || credentials.password !== requiredPassword) {
    return unauthorizedResponse();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
