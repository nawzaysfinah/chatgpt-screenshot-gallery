import { DEFAULT_PROMPT_CROP } from "@/lib/content/constants";

export type PromptCrop = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ConversationPayload = {
  slug?: unknown;
  date?: unknown;
  title?: unknown;
  tags?: unknown;
  model?: unknown;
  topic?: unknown;
  image?: {
    url?: unknown;
    src?: unknown;
    promptCrop?: Partial<PromptCrop>;
  };
};

export type SavedConversationRecord = {
  slug: string;
  date: string;
  title: string;
  tags: string[];
  model?: string;
  topic?: string;
  image: {
    url: string;
    promptCrop: PromptCrop;
  };
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function toTitleCase(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function normalizeDate(rawDate: unknown): string {
  const value = typeof rawDate === "string" ? rawDate.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "";
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "";
  }

  return value;
}

function normalizeTags(rawTags: unknown): string[] {
  if (!Array.isArray(rawTags)) {
    return [];
  }

  const unique = new Set(
    rawTags
      .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
      .filter(Boolean),
  );

  return Array.from(unique);
}

function normalizePromptCrop(rawCrop: Partial<PromptCrop> | undefined): PromptCrop {
  const x = clamp01(rawCrop?.x ?? DEFAULT_PROMPT_CROP.x);
  const y = clamp01(rawCrop?.y ?? DEFAULT_PROMPT_CROP.y);
  const maxW = 1 - x;
  const maxH = 1 - y;
  const w = Math.min(maxW, clamp01(rawCrop?.w ?? DEFAULT_PROMPT_CROP.w));
  const h = Math.min(maxH, clamp01(rawCrop?.h ?? DEFAULT_PROMPT_CROP.h));

  return {
    x,
    y,
    w: w > 0 ? w : DEFAULT_PROMPT_CROP.w,
    h: h > 0 ? h : DEFAULT_PROMPT_CROP.h,
  };
}

function normalizeSlug(rawSlug: unknown, date: string, title: string): string {
  const provided = typeof rawSlug === "string" ? rawSlug.trim() : "";
  const candidate = provided || `${date}-${slugify(title)}`;
  return slugify(candidate) || `${date}-conversation`;
}

export function toConversationRecord(input: ConversationPayload): SavedConversationRecord {
  const date = normalizeDate(input.date);
  if (!date) {
    throw new Error("Valid date is required (YYYY-MM-DD).");
  }

  const rawTitle = typeof input.title === "string" ? input.title.trim() : "";
  const title = rawTitle ? toTitleCase(rawTitle) : "";
  if (!title) {
    throw new Error("Title is required.");
  }

  const rawImageUrl =
    typeof input.image?.url === "string"
      ? input.image.url.trim()
      : typeof input.image?.src === "string"
        ? input.image.src.trim()
        : "";

  if (!/^https?:\/\//i.test(rawImageUrl)) {
    throw new Error("A valid Supabase image URL is required.");
  }

  return {
    slug: normalizeSlug(input.slug, date, title),
    date,
    title,
    tags: normalizeTags(input.tags),
    model: typeof input.model === "string" && input.model.trim() ? input.model.trim() : undefined,
    topic: typeof input.topic === "string" && input.topic.trim() ? input.topic.trim() : undefined,
    image: {
      url: rawImageUrl,
      promptCrop: normalizePromptCrop(input.image?.promptCrop),
    },
  };
}

