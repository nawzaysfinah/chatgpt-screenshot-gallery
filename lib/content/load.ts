import fs from "node:fs/promises";
import path from "node:path";

import { CONTENT_DIR } from "@/lib/content/constants";
import { normalizeConversation } from "@/lib/content/derive";
import type { Conversation, ConversationRecord } from "@/lib/content/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const conversationsDirectory = path.join(process.cwd(), ...CONTENT_DIR);

async function readConversationFile(filePath: string): Promise<Conversation> {
  const contents = await fs.readFile(filePath, "utf8");
  let parsed: ConversationRecord;

  try {
    parsed = JSON.parse(contents) as ConversationRecord;
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${String(error)}`);
  }

  return normalizeConversation(parsed, filePath);
}

async function readLocalConversations(): Promise<Conversation[]> {
  const entries = await fs.readdir(conversationsDirectory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(conversationsDirectory, entry.name));

  const conversations = await Promise.all(files.map(readConversationFile));
  return conversations.sort((a, b) => b.date.localeCompare(a.date));
}

async function readSupabaseConversations(): Promise<Conversation[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("slug, date, title, tags, model, topic, image_url, prompt_crop")
    .order("date", { ascending: false });

  if (error) {
    throw new Error(`Failed to load conversations from Supabase: ${error.message}`);
  }

  return (data ?? []).map((row) =>
    normalizeConversation(
      {
        slug: row.slug,
        date: row.date,
        title: row.title,
        tags: row.tags ?? [],
        model: row.model ?? undefined,
        topic: row.topic ?? undefined,
        image: {
          url: row.image_url,
          promptCrop:
            row.prompt_crop && typeof row.prompt_crop === "object" && !Array.isArray(row.prompt_crop)
              ? row.prompt_crop
              : undefined,
        },
      } satisfies ConversationRecord,
      `supabase:${row.slug}`,
    ),
  );
}

export async function getAllConversations(): Promise<Conversation[]> {
  const shouldUseSupabase = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  if (shouldUseSupabase) {
    try {
      return await readSupabaseConversations();
    } catch {
      if (process.env.NODE_ENV === "production") {
        throw new Error("Supabase content loading failed in production.");
      }
    }
  }

  return readLocalConversations();
}

export async function getConversationBySlug(slug: string): Promise<Conversation | null> {
  const conversations = await getAllConversations();
  return conversations.find((conversation) => conversation.slug === slug) ?? null;
}
