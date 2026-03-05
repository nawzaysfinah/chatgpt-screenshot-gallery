"use client";

import { useEffect, useState } from "react";

import { getClientUserId } from "@/lib/votes/clientUserId";
import { getScore, voteConversation } from "@/lib/votes/api";
import type { VoteResult, VoteValue } from "@/lib/votes/types";

type VoteWidgetProps = {
  slug: string;
  initialScore?: number;
  initialUserVote?: VoteValue;
  compact?: boolean;
  autoLoad?: boolean;
  onVoteChange?: (result: VoteResult) => void;
};

function nextVote(current: VoteValue, clicked: VoteValue): VoteValue {
  return current === clicked ? 0 : clicked;
}

export default function VoteWidget({
  slug,
  initialScore = 0,
  initialUserVote = 0,
  compact = false,
  autoLoad = false,
  onVoteChange,
}: VoteWidgetProps) {
  const [score, setScore] = useState(initialScore);
  const [userVote, setUserVote] = useState<VoteValue>(initialUserVote);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setScore(initialScore);
  }, [initialScore]);

  useEffect(() => {
    setUserVote(initialUserVote);
  }, [initialUserVote]);

  useEffect(() => {
    if (!autoLoad) {
      return;
    }

    let active = true;
    void (async () => {
      try {
        const userId = getClientUserId();
        const result = await getScore(slug, userId);
        if (!active) {
          return;
        }

        setScore(result.score);
        setUserVote(result.userVote);
      } catch {
        if (active) {
          setError("Could not load votes");
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [autoLoad, slug]);

  async function submitVote(value: VoteValue) {
    if (isPending) {
      return;
    }

    setError(null);
    setIsPending(true);

    try {
      const userId = getClientUserId();
      const result = await voteConversation({
        slug,
        userId,
        value: nextVote(userVote, value),
      });

      setScore(result.score);
      setUserVote(result.userVote);
      onVoteChange?.(result);
    } catch {
      setError("Vote failed");
    } finally {
      setIsPending(false);
    }
  }

  const buttonSize = compact ? "h-8 w-8 text-sm" : "h-10 w-10 text-base";
  const scoreSize = compact ? "text-sm" : "text-base";

  return (
    <div className="flex flex-col gap-1">
      <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1 py-1">
        <button
          type="button"
          aria-label="Upvote"
          disabled={isPending}
          onClick={() => void submitVote(1)}
          className={`${buttonSize} rounded-full font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${
            userVote === 1
              ? "bg-emerald-100 text-emerald-700"
              : "text-slate-600 hover:bg-slate-100"
          } ${isPending ? "cursor-not-allowed opacity-60" : ""}`}
        >
          ▲
        </button>

        <span
          aria-live="polite"
          aria-label={`Score ${score}`}
          className={`min-w-8 text-center font-semibold text-slate-900 ${scoreSize}`}
        >
          {score}
        </span>

        <button
          type="button"
          aria-label="Downvote"
          disabled={isPending}
          onClick={() => void submitVote(-1)}
          className={`${buttonSize} rounded-full font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${
            userVote === -1
              ? "bg-rose-100 text-rose-700"
              : "text-slate-600 hover:bg-slate-100"
          } ${isPending ? "cursor-not-allowed opacity-60" : ""}`}
        >
          ▼
        </button>
      </div>

      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
