type VoteValue = -1 | 0 | 1;

type Env = {
  DB?: D1Database;
  VOTES_KV?: KVNamespace;
  ALLOWED_ORIGINS?: string;
  RATE_LIMIT_PER_MINUTE?: string;
};

type VoteBody = {
  slug?: unknown;
  userId?: unknown;
  value?: unknown;
};

type BatchBody = {
  slugs?: unknown;
  userId?: unknown;
};

const SLUG_REGEX = /^[a-z0-9][a-z0-9-_]{0,139}$/;
const USER_ID_REGEX = /^[A-Za-z0-9._:-]{8,128}$/;
const MAX_BATCH_SLUGS = 100;
const MAX_BODY_CHARS = 2048;
const DEFAULT_RATE_LIMIT_PER_MINUTE = 120;

const rateLimiter = new Map<string, { count: number; resetAt: number }>();

function parseAllowedOrigins(value?: string): Set<string> {
  if (!value) {
    return new Set();
  }

  return new Set(
    value
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function corsOriginForRequest(request: Request, env: Env): string | null {
  const requestOrigin = request.headers.get("Origin");
  const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);

  if (!requestOrigin) {
    return "*";
  }

  if (allowedOrigins.size === 0) {
    return requestOrigin;
  }

  return allowedOrigins.has(requestOrigin) ? requestOrigin : null;
}

function corsHeaders(origin: string): Headers {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Vary", "Origin");
  return headers;
}

function jsonResponse(payload: unknown, status: number, origin: string): Response {
  const headers = corsHeaders(origin);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(payload), { status, headers });
}

function errorResponse(message: string, status: number, origin: string): Response {
  return jsonResponse({ error: message }, status, origin);
}

function normalizeVoteValue(value: number): VoteValue {
  if (value > 0) {
    return 1;
  }

  if (value < 0) {
    return -1;
  }

  return 0;
}

function parseVoteValue(input: unknown): VoteValue | null {
  if (input === -1 || input === 0 || input === 1) {
    return input;
  }

  return null;
}

function parseSlug(input: unknown): string | null {
  if (typeof input !== "string") {
    return null;
  }

  const slug = input.trim().toLowerCase();
  if (!SLUG_REGEX.test(slug)) {
    return null;
  }

  return slug;
}

function parseUserId(input: unknown): string | null {
  if (typeof input !== "string") {
    return null;
  }

  const userId = input.trim();
  if (!USER_ID_REGEX.test(userId)) {
    return null;
  }

  return userId;
}

function uniqueValidSlugs(candidates: unknown): string[] | null {
  if (!Array.isArray(candidates)) {
    return null;
  }

  const normalized = candidates
    .map((candidate) => parseSlug(candidate))
    .filter((slug): slug is string => Boolean(slug));

  const unique = Array.from(new Set(normalized));
  if (unique.length === 0 || unique.length > MAX_BATCH_SLUGS) {
    return null;
  }

  return unique;
}

function getClientIp(request: Request): string {
  const cfIp = request.headers.get("CF-Connecting-IP");
  if (cfIp) {
    return cfIp;
  }

  const forwardedFor = request.headers.get("X-Forwarded-For");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return "unknown";
}

function withinRateLimit(request: Request, env: Env): boolean {
  const rawLimit = Number.parseInt(env.RATE_LIMIT_PER_MINUTE ?? "", 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : DEFAULT_RATE_LIMIT_PER_MINUTE;
  const ip = getClientIp(request);
  const now = Date.now();

  const existing = rateLimiter.get(ip);
  if (!existing || now > existing.resetAt) {
    rateLimiter.set(ip, {
      count: 1,
      resetAt: now + 60_000,
    });
    return true;
  }

  if (existing.count >= limit) {
    return false;
  }

  existing.count += 1;
  rateLimiter.set(ip, existing);
  return true;
}

async function parseJsonBody<T>(request: Request): Promise<T | null> {
  const bodyText = await request.text();
  if (bodyText.length > MAX_BODY_CHARS) {
    return null;
  }

  try {
    return JSON.parse(bodyText) as T;
  } catch {
    return null;
  }
}

async function getScoreForSlugD1(db: D1Database, slug: string): Promise<number> {
  const row = await db.prepare("SELECT score FROM scores WHERE slug = ?").bind(slug).first<{ score: number }>();
  return row?.score ?? 0;
}

async function getUserVoteForSlugD1(db: D1Database, slug: string, userId: string): Promise<VoteValue> {
  const row = await db
    .prepare("SELECT value FROM votes WHERE slug = ? AND userId = ?")
    .bind(slug, userId)
    .first<{ value: number }>();
  return normalizeVoteValue(row?.value ?? 0);
}

async function voteWithD1(db: D1Database, slug: string, userId: string, value: VoteValue) {
  let transactionCommitted = false;

  try {
    await db.exec("BEGIN IMMEDIATE TRANSACTION");

    const oldVoteRow = await db
      .prepare("SELECT value FROM votes WHERE slug = ? AND userId = ?")
      .bind(slug, userId)
      .first<{ value: number }>();

    const oldVote = normalizeVoteValue(oldVoteRow?.value ?? 0);
    const delta = value - oldVote;
    const nowIso = new Date().toISOString();

    if (value === 0) {
      await db.prepare("DELETE FROM votes WHERE slug = ? AND userId = ?").bind(slug, userId).run();
    } else {
      await db
        .prepare(
          "INSERT INTO votes (slug, userId, value, updatedAt) VALUES (?, ?, ?, ?) ON CONFLICT(slug, userId) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt",
        )
        .bind(slug, userId, value, nowIso)
        .run();
    }

    await db
      .prepare("INSERT INTO scores (slug, score, updatedAt) VALUES (?, 0, ?) ON CONFLICT(slug) DO NOTHING")
      .bind(slug, nowIso)
      .run();

    if (delta !== 0) {
      await db
        .prepare("UPDATE scores SET score = score + ?, updatedAt = ? WHERE slug = ?")
        .bind(delta, nowIso, slug)
        .run();
    }

    const score = await getScoreForSlugD1(db, slug);

    await db.exec("COMMIT");
    transactionCommitted = true;

    return {
      slug,
      score,
      userVote: value,
    };
  } finally {
    if (!transactionCommitted) {
      try {
        await db.exec("ROLLBACK");
      } catch {
        // Ignore rollback failures.
      }
    }
  }
}

async function batchWithD1(db: D1Database, slugs: string[], userId?: string) {
  const scoreMap: Record<string, number> = {};
  const userVoteMap: Record<string, VoteValue> = {};

  for (const slug of slugs) {
    scoreMap[slug] = 0;
    userVoteMap[slug] = 0;
  }

  const placeholders = slugs.map(() => "?").join(",");

  const scoreRows = await db
    .prepare(`SELECT slug, score FROM scores WHERE slug IN (${placeholders})`)
    .bind(...slugs)
    .all<{ slug: string; score: number }>();

  for (const row of scoreRows.results) {
    scoreMap[row.slug] = row.score;
  }

  if (userId) {
    const voteRows = await db
      .prepare(`SELECT slug, value FROM votes WHERE userId = ? AND slug IN (${placeholders})`)
      .bind(userId, ...slugs)
      .all<{ slug: string; value: number }>();

    for (const row of voteRows.results) {
      userVoteMap[row.slug] = normalizeVoteValue(row.value);
    }
  }

  return {
    scores: scoreMap,
    userVotes: userVoteMap,
  };
}

function voteKey(slug: string, userId: string): string {
  return `vote:${slug}:${userId}`;
}

function scoreKey(slug: string): string {
  return `score:${slug}`;
}

async function voteWithKv(kv: KVNamespace, slug: string, userId: string, value: VoteValue) {
  const oldValueRaw = await kv.get(voteKey(slug, userId));
  const oldValue = normalizeVoteValue(Number.parseInt(oldValueRaw ?? "0", 10));
  const delta = value - oldValue;

  if (value === 0) {
    await kv.delete(voteKey(slug, userId));
  } else {
    await kv.put(voteKey(slug, userId), String(value));
  }

  const currentScoreRaw = await kv.get(scoreKey(slug));
  const currentScore = Number.parseInt(currentScoreRaw ?? "0", 10);
  const nextScore = (Number.isFinite(currentScore) ? currentScore : 0) + delta;
  await kv.put(scoreKey(slug), String(nextScore));

  return {
    slug,
    score: nextScore,
    userVote: value,
  };
}

async function getScoreFromKv(kv: KVNamespace, slug: string): Promise<number> {
  const scoreRaw = await kv.get(scoreKey(slug));
  const parsed = Number.parseInt(scoreRaw ?? "0", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function getUserVoteFromKv(kv: KVNamespace, slug: string, userId: string): Promise<VoteValue> {
  const voteRaw = await kv.get(voteKey(slug, userId));
  return normalizeVoteValue(Number.parseInt(voteRaw ?? "0", 10));
}

async function batchWithKv(kv: KVNamespace, slugs: string[], userId?: string) {
  const scoreMap: Record<string, number> = {};
  const userVoteMap: Record<string, VoteValue> = {};

  for (const slug of slugs) {
    scoreMap[slug] = await getScoreFromKv(kv, slug);
    userVoteMap[slug] = userId ? await getUserVoteFromKv(kv, slug, userId) : 0;
  }

  return {
    scores: scoreMap,
    userVotes: userVoteMap,
  };
}

function hasD1(env: Env): env is Env & { DB: D1Database } {
  return Boolean(env.DB);
}

function hasKv(env: Env): env is Env & { VOTES_KV: KVNamespace } {
  return Boolean(env.VOTES_KV);
}

async function handleVote(request: Request, env: Env, origin: string): Promise<Response> {
  if (!withinRateLimit(request, env)) {
    return errorResponse("Rate limit exceeded", 429, origin);
  }

  const body = await parseJsonBody<VoteBody>(request);
  if (!body) {
    return errorResponse("Invalid JSON body", 400, origin);
  }

  const slug = parseSlug(body.slug);
  const userId = parseUserId(body.userId);
  const value = parseVoteValue(body.value);

  if (!slug || !userId || value === null) {
    return errorResponse("Invalid slug, userId, or value", 400, origin);
  }

  try {
    const result = hasD1(env)
      ? await voteWithD1(env.DB, slug, userId, value)
      : hasKv(env)
        ? await voteWithKv(env.VOTES_KV, slug, userId, value)
        : null;

    if (!result) {
      return errorResponse("No storage binding configured", 500, origin);
    }

    return jsonResponse(result, 200, origin);
  } catch (error) {
    return errorResponse(`Failed to save vote: ${String(error)}`, 500, origin);
  }
}

async function handleScore(request: Request, env: Env, origin: string): Promise<Response> {
  const url = new URL(request.url);
  const slug = parseSlug(url.searchParams.get("slug"));
  const rawUserId = url.searchParams.get("userId");

  if (!slug) {
    return errorResponse("Invalid slug", 400, origin);
  }

  if (!withinRateLimit(request, env)) {
    return errorResponse("Rate limit exceeded", 429, origin);
  }

  const userId = rawUserId ? parseUserId(rawUserId) : undefined;
  if (rawUserId && !userId) {
    return errorResponse("Invalid userId", 400, origin);
  }

  if (hasD1(env)) {
    const score = await getScoreForSlugD1(env.DB, slug);
    const userVote = userId ? await getUserVoteForSlugD1(env.DB, slug, userId) : 0;
    return jsonResponse({ slug, score, userVote }, 200, origin);
  }

  if (hasKv(env)) {
    const score = await getScoreFromKv(env.VOTES_KV, slug);
    const userVote = userId ? await getUserVoteFromKv(env.VOTES_KV, slug, userId) : 0;
    return jsonResponse({ slug, score, userVote }, 200, origin);
  }

  return errorResponse("No storage binding configured", 500, origin);
}

async function handleBatchScores(request: Request, env: Env, origin: string): Promise<Response> {
  if (!withinRateLimit(request, env)) {
    return errorResponse("Rate limit exceeded", 429, origin);
  }

  let slugs: string[] | null = null;
  let userId: string | undefined;

  if (request.method === "GET") {
    const url = new URL(request.url);
    const slugString = url.searchParams.get("slugs") ?? "";
    const candidates = slugString
      .split(",")
      .map((slug) => slug.trim())
      .filter(Boolean);

    slugs = uniqueValidSlugs(candidates);
    const rawUserId = url.searchParams.get("userId");
    userId = rawUserId ? parseUserId(rawUserId) ?? undefined : undefined;

    if (rawUserId && !userId) {
      return errorResponse("Invalid userId", 400, origin);
    }
  }

  if (request.method === "POST") {
    const body = await parseJsonBody<BatchBody>(request);
    if (!body) {
      return errorResponse("Invalid JSON body", 400, origin);
    }

    slugs = uniqueValidSlugs(body.slugs);

    if (body.userId !== undefined) {
      const parsedUserId = parseUserId(body.userId);
      if (!parsedUserId) {
        return errorResponse("Invalid userId", 400, origin);
      }
      userId = parsedUserId;
    }
  }

  if (!slugs) {
    return errorResponse("Invalid slugs payload", 400, origin);
  }

  if (hasD1(env)) {
    const payload = await batchWithD1(env.DB, slugs, userId);
    return jsonResponse(payload, 200, origin);
  }

  if (hasKv(env)) {
    const payload = await batchWithKv(env.VOTES_KV, slugs, userId);
    return jsonResponse(payload, 200, origin);
  }

  return errorResponse("No storage binding configured", 500, origin);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = corsOriginForRequest(request, env);
    if (!origin) {
      return new Response("Forbidden origin", { status: 403 });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    const { pathname } = new URL(request.url);

    if (request.method === "GET" && pathname === "/") {
      return jsonResponse(
        {
          service: "chatgpt-screenshot-gallery-votes",
          status: "ok",
          storage: hasD1(env) ? "d1" : hasKv(env) ? "kv" : "none",
        },
        200,
        origin,
      );
    }

    if (request.method === "GET" && pathname === "/score") {
      return handleScore(request, env, origin);
    }

    if (pathname === "/batch-scores" && (request.method === "GET" || request.method === "POST")) {
      return handleBatchScores(request, env, origin);
    }

    if (request.method === "POST" && pathname === "/vote") {
      return handleVote(request, env, origin);
    }

    return errorResponse("Route not found", 404, origin);
  },
};
