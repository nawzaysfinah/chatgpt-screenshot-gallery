import fs from "node:fs/promises";
import path from "node:path";
import { cache } from "react";

import { CONTENT_DIR } from "@/lib/content/constants";
import { normalizeConversation } from "@/lib/content/derive";
import type { Conversation, ConversationRecord } from "@/lib/content/types";

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

export const getAllConversations = cache(async (): Promise<Conversation[]> => {
  const entries = await fs.readdir(conversationsDirectory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(conversationsDirectory, entry.name));

  const conversations = await Promise.all(files.map(readConversationFile));
  return conversations.sort((a, b) => b.date.localeCompare(a.date));
});

export const getConversationBySlug = cache(async (slug: string): Promise<Conversation | null> => {
  const conversations = await getAllConversations();
  return conversations.find((conversation) => conversation.slug === slug) ?? null;
});
