import { NextResponse } from "next/server";

import { toConversationRecord, type ConversationPayload } from "@/lib/admin/conversationRecord";
import { getSessionTokenFromCookieHeader, verifySessionToken } from "@/lib/admin/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const isAuthenticated = verifySessionToken(getSessionTokenFromCookieHeader(request.headers.get("cookie")));
  if (!isAuthenticated) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as ConversationPayload | null;
  if (!body) {
    return NextResponse.json({ ok: false, message: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    const record = toConversationRecord(body);
    const supabase = createSupabaseServerClient();

    const { error } = await supabase.from("conversations").upsert(
      {
        slug: record.slug,
        date: record.date,
        title: record.title,
        tags: record.tags,
        model: record.model ?? null,
        topic: record.topic ?? null,
        image_url: record.image.url,
        prompt_crop: record.image.promptCrop,
      },
      {
        onConflict: "slug",
      },
    );

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      slug: record.slug,
      message: `Saved metadata for ${record.slug}.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Failed to save metadata.",
      },
      { status: 400 },
    );
  }
}

