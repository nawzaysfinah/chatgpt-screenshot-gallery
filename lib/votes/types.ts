export type VoteValue = -1 | 0 | 1;

export type VoteRequest = {
  slug: string;
  userId: string;
  value: VoteValue;
};

export type VoteResult = {
  slug: string;
  score: number;
  userVote: VoteValue;
};

export type BatchScoresResult = {
  scores: Record<string, number>;
  userVotes: Record<string, VoteValue>;
};
