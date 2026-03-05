import { mockBatchScores, mockGetScore, mockVote } from "@/lib/votes/mock";
import type { BatchScoresResult, VoteRequest, VoteResult } from "@/lib/votes/types";

const apiBase = process.env.NEXT_PUBLIC_VOTE_API_BASE?.trim().replace(/\/$/, "");

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Vote API error ${response.status}: ${body || "Unknown error"}`);
  }

  return (await response.json()) as T;
}

export async function voteConversation(payload: VoteRequest): Promise<VoteResult> {
  if (!apiBase) {
    return mockVote(payload);
  }

  const response = await fetch(`${apiBase}/vote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJson<VoteResult>(response);
}

export async function getScore(slug: string, userId?: string): Promise<VoteResult> {
  if (!apiBase) {
    return mockGetScore(slug, userId);
  }

  const url = new URL(`${apiBase}/score`);
  url.searchParams.set("slug", slug);
  if (userId) {
    url.searchParams.set("userId", userId);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  return parseJson<VoteResult>(response);
}

export async function getBatchScores(slugs: string[], userId?: string): Promise<BatchScoresResult> {
  if (!apiBase) {
    return mockBatchScores(slugs, userId);
  }

  const response = await fetch(`${apiBase}/batch-scores`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ slugs, userId }),
  });

  return parseJson<BatchScoresResult>(response);
}
