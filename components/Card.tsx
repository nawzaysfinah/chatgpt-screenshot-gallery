"use client";

import Link from "next/link";

import ThumbnailCanvas from "@/components/ThumbnailCanvas";
import VoteWidget from "@/components/VoteWidget";
import type { Conversation } from "@/lib/content/types";
import type { VoteResult, VoteValue } from "@/lib/votes/types";

type CardProps = {
  conversation: Conversation;
  score: number;
  userVote: VoteValue;
  onVoteChange?: (result: VoteResult) => void;
};

function tagList(conversation: Conversation): string[] {
  const tags = [...conversation.tags];
  if (conversation.topic) {
    tags.push(conversation.topic);
  }
  if (conversation.model) {
    tags.push(conversation.model);
  }
  return tags;
}

export default function Card({ conversation, score, userVote, onVoteChange }: CardProps) {
  const tags = tagList(conversation);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-950/70 shadow-[0_16px_56px_rgba(2,6,23,0.38)] transition hover:border-teal-500/50 hover:shadow-[0_20px_72px_rgba(13,148,136,0.16)]">
      <Link
        href={`/c/${conversation.slug}`}
        className="block p-4"
        aria-label={`Open conversation ${conversation.title}`}
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          {conversation.date}
        </p>

        <ThumbnailCanvas
          src={conversation.image.src}
          crop={conversation.image.promptCrop}
          alt={`Prompt thumbnail for ${conversation.title}`}
        />

        <h2 className="mt-4 line-clamp-2 text-lg font-semibold text-slate-100 transition group-hover:text-teal-300">
          {conversation.title}
        </h2>
      </Link>

      <div className="mt-auto flex items-end justify-between gap-3 border-t border-slate-800/80 px-4 py-3">
        <div className="flex min-h-[2.25rem] flex-wrap items-center gap-2">
          {tags.slice(0, 4).map((tag) => (
            <span
              key={`${conversation.slug}-${tag}`}
              className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-300"
            >
              {tag}
            </span>
          ))}
        </div>

        <VoteWidget
          slug={conversation.slug}
          compact
          autoLoad={false}
          initialScore={score}
          initialUserVote={userVote}
          onVoteChange={onVoteChange}
        />
      </div>
    </article>
  );
}
