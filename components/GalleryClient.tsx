"use client";

import { useEffect, useMemo, useState } from "react";

import Card from "@/components/Card";
import Header, { type SortOption } from "@/components/Header";
import type { Conversation } from "@/lib/content/types";
import { getBatchScores } from "@/lib/votes/api";
import { getClientUserId } from "@/lib/votes/clientUserId";
import type { VoteResult, VoteValue } from "@/lib/votes/types";

type GalleryClientProps = {
  conversations: Conversation[];
};

export default function GalleryClient({ conversations }: GalleryClientProps) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [userVotes, setUserVotes] = useState<Record<string, VoteValue>>({});
  const [voteError, setVoteError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const userId = getClientUserId();
        const result = await getBatchScores(
          conversations.map((conversation) => conversation.slug),
          userId,
        );

        if (!active) {
          return;
        }

        setScores(result.scores);
        setUserVotes(result.userVotes);
      } catch {
        if (active) {
          setVoteError("Vote backend unavailable. Showing local state only.");
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [conversations]);

  function handleVoteUpdate(result: VoteResult) {
    setScores((previous) => ({
      ...previous,
      [result.slug]: result.score,
    }));
    setUserVotes((previous) => ({
      ...previous,
      [result.slug]: result.userVote,
    }));
  }

  const visibleConversations = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const filtered = normalizedSearch
      ? conversations.filter((conversation) => {
          const haystack = [
            conversation.title,
            conversation.date,
            conversation.topic ?? "",
            conversation.model ?? "",
            conversation.tags.join(" "),
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(normalizedSearch);
        })
      : conversations;

    return [...filtered].sort((left, right) => {
      if (sort === "oldest") {
        return left.date.localeCompare(right.date);
      }

      if (sort === "top") {
        const scoreDiff = (scores[right.slug] ?? 0) - (scores[left.slug] ?? 0);
        if (scoreDiff !== 0) {
          return scoreDiff;
        }
      }

      return right.date.localeCompare(left.date);
    });
  }, [conversations, scores, search, sort]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Header search={search} sort={sort} onSearchChange={setSearch} onSortChange={setSort} />

      <div className="mb-5 flex items-center justify-between gap-3 text-sm text-slate-600">
        <p>
          {visibleConversations.length} conversation
          {visibleConversations.length === 1 ? "" : "s"}
        </p>
        {voteError ? <p className="text-amber-700">{voteError}</p> : null}
      </div>

      {visibleConversations.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-base font-medium text-slate-900">No conversations match your search.</p>
          <p className="mt-2 text-sm text-slate-600">Try a different keyword, model, or tag.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visibleConversations.map((conversation) => (
            <Card
              key={conversation.slug}
              conversation={conversation}
              score={scores[conversation.slug] ?? 0}
              userVote={userVotes[conversation.slug] ?? 0}
              onVoteChange={handleVoteUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
