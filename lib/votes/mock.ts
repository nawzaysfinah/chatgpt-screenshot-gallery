import type { BatchScoresResult, VoteRequest, VoteResult, VoteValue } from "@/lib/votes/types";

const scores = new Map<string, number>();
const userVotes = new Map<string, VoteValue>();

function voteKey(slug: string, userId: string): string {
  return `${slug}::${userId}`;
}

export async function mockVote(payload: VoteRequest): Promise<VoteResult> {
  const key = voteKey(payload.slug, payload.userId);
  const oldValue = userVotes.get(key) ?? 0;
  const delta = payload.value - oldValue;

  if (payload.value === 0) {
    userVotes.delete(key);
  } else {
    userVotes.set(key, payload.value);
  }

  const nextScore = (scores.get(payload.slug) ?? 0) + delta;
  scores.set(payload.slug, nextScore);

  return {
    slug: payload.slug,
    score: nextScore,
    userVote: payload.value,
  };
}

export async function mockGetScore(slug: string, userId?: string): Promise<VoteResult> {
  const vote = userId ? userVotes.get(voteKey(slug, userId)) ?? 0 : 0;
  return {
    slug,
    score: scores.get(slug) ?? 0,
    userVote: vote,
  };
}

export async function mockBatchScores(slugs: string[], userId?: string): Promise<BatchScoresResult> {
  const uniqueSlugs = Array.from(new Set(slugs));
  const scoreResult: Record<string, number> = {};
  const userVoteResult: Record<string, VoteValue> = {};

  for (const slug of uniqueSlugs) {
    scoreResult[slug] = scores.get(slug) ?? 0;
    userVoteResult[slug] = userId ? (userVotes.get(voteKey(slug, userId)) ?? 0) : 0;
  }

  return {
    scores: scoreResult,
    userVotes: userVoteResult,
  };
}
