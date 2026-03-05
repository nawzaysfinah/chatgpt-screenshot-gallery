import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import VoteWidget from "@/components/VoteWidget";
import { getAllConversations, getConversationBySlug } from "@/lib/content/load";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateStaticParams() {
  const conversations = await getAllConversations();
  return conversations.map((conversation) => ({ slug: conversation.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const conversation = await getConversationBySlug(slug);

  if (!conversation) {
    return {
      title: "Conversation Not Found",
    };
  }

  return {
    title: `${conversation.title} | ChatGPT Screenshot Gallery`,
    description: `Full screenshot for ${conversation.title} on ${conversation.date}.`,
  };
}

export default async function ConversationPage({ params }: PageProps) {
  const { slug } = await params;
  const conversation = await getConversationBySlug(slug);

  if (!conversation) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/"
        className="inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
      >
        ← Back to gallery
      </Link>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          {conversation.date}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          {conversation.title}
        </h1>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {conversation.tags.map((tag) => (
              <span
                key={`${conversation.slug}-${tag}`}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600"
              >
                {tag}
              </span>
            ))}
            {conversation.topic ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                {conversation.topic}
              </span>
            ) : null}
            {conversation.model ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                {conversation.model}
              </span>
            ) : null}
          </div>

          <VoteWidget slug={conversation.slug} autoLoad />
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <a
          href={conversation.image.src}
          target="_blank"
          rel="noopener noreferrer"
          className="block overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
          aria-label="Open full screenshot in new tab"
        >
          <Image
            src={conversation.image.src}
            alt={`Full screenshot for ${conversation.title}`}
            width={900}
            height={2200}
            priority
            unoptimized
            className="mx-auto w-full max-w-[900px]"
          />
        </a>
      </section>
    </main>
  );
}
