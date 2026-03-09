import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("slug, date, title, tags, model, topic, image_url, prompt_crop, created_at, updated_at")
    .eq("owner_id", user.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    conversations: (data ?? []).map((conversation) => ({
      slug: conversation.slug,
      date: conversation.date,
      title: conversation.title,
      tags: conversation.tags ?? [],
      model: conversation.model ?? "",
      topic: conversation.topic ?? "",
      image: {
        url: conversation.image_url,
        promptCrop:
          conversation.prompt_crop &&
          typeof conversation.prompt_crop === "object" &&
          !Array.isArray(conversation.prompt_crop)
            ? conversation.prompt_crop
            : null,
      },
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
    })),
  });
}
