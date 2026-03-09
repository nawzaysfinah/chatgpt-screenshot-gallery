export type DerivedMetadata = {
  date: string;
  title: string;
  slug: string;
};

const DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})(?:__(.+))?$/;

function toTitleCase(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function kebabCase(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function parseDate(value: string): string {
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

export function deriveMetadataFromFilename(filename: string): DerivedMetadata {
  const stem = filename.replace(/\.[^.]+$/, "").trim();
  const match = stem.match(DATE_PREFIX);

  if (!match) {
    const fallbackTitle = stem ? toTitleCase(stem.replace(/[_-]+/g, " ")) : "Untitled Conversation";
    const fallbackDate = "";
    const fallbackSlugTail = kebabCase(stem || "conversation");

    return {
      date: fallbackDate,
      title: fallbackTitle,
      slug: fallbackSlugTail,
    };
  }

  const [, rawDate, rawTail] = match;
  const safeDate = parseDate(rawDate);
  const cleanedTail = (rawTail || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const title = cleanedTail ? toTitleCase(cleanedTail) : "Untitled Conversation";
  const slugTail = kebabCase(rawTail || title || "conversation");

  return {
    date: safeDate,
    title,
    slug: safeDate ? `${safeDate}-${slugTail}` : slugTail,
  };
}

export function parseTagsInput(tagsInput: string): string[] {
  const unique = new Set(
    tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
  );
  return Array.from(unique);
}

export function tagsToInput(tags: string[]): string {
  return tags.join(", ");
}
