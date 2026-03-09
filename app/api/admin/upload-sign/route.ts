import { NextResponse } from "next/server";

import { getSessionTokenFromCookieHeader, verifySessionToken } from "@/lib/admin/session";
import { createSupabaseServerClient, supabaseBucket } from "@/lib/supabase/server";

export const runtime = "nodejs";

type UploadBody = {
  slug?: unknown;
  extension?: unknown;
};

function normalizeSlug(input: unknown): string {
  const raw = typeof input === "string" ? input.trim() : "";
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "") || `conversation-${Date.now()}`
  );
}

function normalizeExtension(input: unknown): string {
  const raw = typeof input === "string" ? input.trim().toLowerCase() : "";
  if (raw === "png" || raw === "jpg" || raw === "jpeg" || raw === "webp") {
    return raw === "jpeg" ? "jpg" : raw;
  }
  return "png";
}

export async function POST(request: Request) {
  const isAuthenticated = verifySessionToken(getSessionTokenFromCookieHeader(request.headers.get("cookie")));
  if (!isAuthenticated) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as UploadBody | null;
  const slug = normalizeSlug(body?.slug);
  const extension = normalizeExtension(body?.extension);
  const storagePath = `screenshots/${slug}.${extension}`;

  const supabase = createSupabaseServerClient();
  const bucket = supabaseBucket();
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(storagePath);

  if (error || !data) {
    return NextResponse.json(
      { ok: false, message: error?.message || "Failed to create signed upload URL." },
      { status: 500 },
    );
  }

  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);

  return NextResponse.json({
    ok: true,
    bucket,
    path: storagePath,
    token: data.token,
    signedUrl: data.signedUrl,
    publicUrl: publicUrlData.publicUrl,
  });
}

