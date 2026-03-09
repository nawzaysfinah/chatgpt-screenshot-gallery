import { NextResponse } from "next/server";

import { toConversationRecord, type ConversationPayload } from "@/lib/admin/conversationRecord";
import { authenticateRequest } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const slug = url.searchParams.get("slug")?.trim().toLowerCase();
  if (!slug) {
    return NextResponse.json({ ok: false, message: "Slug is required." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("slug, date, title, tags, model, topic, image_url, prompt_crop, owner_id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ ok: false, message: "Conversation not found." }, { status: 404 });
  }

  if (data.owner_id && data.owner_id !== user.id) {
    return NextResponse.json({ ok: false, message: "Conversation not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    conversation: {
      slug: data.slug,
      date: data.date,
      title: data.title,
      tags: data.tags ?? [],
      model: data.model ?? "",
      topic: data.topic ?? "",
      image: {
        url: data.image_url,
        promptCrop:
          data.prompt_crop && typeof data.prompt_crop === "object" && !Array.isArray(data.prompt_crop)
            ? data.prompt_crop
            : null,
      },
    },
  });
}

export async function POST(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as ConversationPayload | null;
  if (!body) {
    return NextResponse.json({ ok: false, message: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    const record = toConversationRecord(body);
    const supabase = createSupabaseServerClient();
    const { data: existing, error: existingError } = await supabase
      .from("conversations")
      .select("owner_id")
      .eq("slug", record.slug)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (existing?.owner_id && existing.owner_id !== user.id) {
      return NextResponse.json(
        {
          ok: false,
          message: "That slug is already used by another account. Change the title or slug and save again.",
        },
        { status: 409 },
      );
    }

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
        owner_id: user.id,
        owner_email: user.email,
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
      message: existing ? `Updated metadata for ${record.slug}.` : `Saved metadata for ${record.slug}.`,
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
