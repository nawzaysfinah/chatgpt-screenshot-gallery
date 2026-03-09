import path from "node:path";

import { DEFAULT_PROMPT_CROP } from "@/lib/content/constants";
import type { Conversation, ConversationRecord, PromptCrop } from "@/lib/content/types";

type FilenameDerived = {
  date?: string;
  title?: string;
  slug?: string;
};

const DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})(?:__(.+))?$/;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

export function toTitleCase(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function kebabCase(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function isDateString(value?: string): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function deriveFromStem(stem: string): FilenameDerived {
  const match = stem.match(DATE_PREFIX);
  if (!match) {
    return {};
  }

  const [, date, rawTail] = match;
  const cleanedTail = (rawTail ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const title = cleanedTail ? toTitleCase(cleanedTail) : undefined;
  const slugTail = rawTail ? kebabCase(rawTail) : undefined;
  const slug = slugTail ? `${date}-${slugTail}` : date;

  return { date, title, slug };
}

function normalizeTags(tags?: string[]): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  const unique = new Set(
    tags
      .map((tag) => tag?.trim())
      .filter((tag): tag is string => Boolean(tag)),
  );
  return Array.from(unique);
}

function normalizeCrop(promptCrop?: Partial<PromptCrop>): PromptCrop {
  const x = clamp01(promptCrop?.x ?? DEFAULT_PROMPT_CROP.x);
  const y = clamp01(promptCrop?.y ?? DEFAULT_PROMPT_CROP.y);
  const maxW = 1 - x;
  const maxH = 1 - y;
  const w = Math.min(maxW, clamp01(promptCrop?.w ?? DEFAULT_PROMPT_CROP.w));
  const h = Math.min(maxH, clamp01(promptCrop?.h ?? DEFAULT_PROMPT_CROP.h));

  return {
    x,
    y,
    w: w > 0 ? w : DEFAULT_PROMPT_CROP.w,
    h: h > 0 ? h : DEFAULT_PROMPT_CROP.h,
  };
}

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function normalizeImageSource(
  image: ConversationRecord["image"],
  fileStem?: string,
): { src: string; url?: string } {
  const candidate = image?.url?.trim() || image?.src?.trim();
  if (candidate) {
    if (isAbsoluteUrl(candidate)) {
      return { src: candidate, url: candidate };
    }

    const normalized = candidate.startsWith("/") ? candidate : `/${candidate}`;
    return { src: normalized };
  }

  const fallbackStem = fileStem ? kebabCase(fileStem) : "conversation";
  return { src: `/uploads/${fallbackStem}.png` };
}

export function normalizeConversation(
  record: ConversationRecord,
  sourceFile: string,
): Conversation {
  const sourceBaseName = path.basename(sourceFile, path.extname(sourceFile));
  const fromJsonName = deriveFromStem(sourceBaseName);
  const imageSource = normalizeImageSource(record.image, sourceBaseName);
  const imageSrc = imageSource.src;
  const imageBaseName = path.basename(imageSrc, path.extname(imageSrc));
  const fromImageName = deriveFromStem(imageBaseName);

  const dateCandidate = record.date?.trim() || fromImageName.date || fromJsonName.date;
  const date = isDateString(dateCandidate) ? dateCandidate : "1970-01-01";

  const titleCandidate =
    record.title?.trim() || fromImageName.title || fromJsonName.title || "Untitled Conversation";
  const title = toTitleCase(titleCandidate);

  const slugCandidate =
    record.slug?.trim() ||
    fromImageName.slug ||
    fromJsonName.slug ||
    `${date}-${kebabCase(titleCandidate)}`;
  const slug = kebabCase(slugCandidate) || `${date}-conversation`;

  return {
    slug,
    date,
    title,
    tags: normalizeTags(record.tags),
    model: record.model?.trim() || undefined,
    topic: record.topic?.trim() || undefined,
    image: {
      src: imageSrc,
      url: imageSource.url,
      promptCrop: normalizeCrop(record.image?.promptCrop),
    },
    sourceFile,
  };
}
