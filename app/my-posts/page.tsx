"use client";

import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import ThumbnailCanvas from "@/components/ThumbnailCanvas";
import { DEFAULT_PROMPT_CROP } from "@/lib/content/constants";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type PromptCrop = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type MyPost = {
  slug: string;
  date: string;
  title: string;
  tags: string[];
  model: string;
  topic: string;
  image: {
    url: string;
    promptCrop: Partial<PromptCrop> | null;
  };
  createdAt: string | null;
  updatedAt: string | null;
};

type MyPostsResponse = {
  ok: boolean;
  conversations: MyPost[];
};

function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString();
}

export default function MyPostsPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [checkingSession, setCheckingSession] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [posts, setPosts] = useState<MyPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const authenticated = Boolean(session?.user);
  const accessToken = session?.access_token ?? null;

  useEffect(() => {
    let isMounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return;
      }

      setSession(data.session ?? null);
      setCheckingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession);
      setCheckingSession(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!accessToken) {
      setPosts([]);
      return;
    }

    let active = true;
    setLoadingPosts(true);
    setErrorMessage(null);

    void fetch("/api/admin/my-posts", {
      method: "GET",
      cache: "no-store",
      headers: authHeaders(accessToken),
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as Partial<MyPostsResponse> & {
          message?: string;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(
            typeof payload.message === "string"
              ? payload.message
              : typeof payload.error === "string"
                ? payload.error
                : `Request failed (${response.status})`,
          );
        }

        return payload as MyPostsResponse;
      })
      .then((payload) => {
        if (!active) {
          return;
        }

        setPosts(payload.conversations ?? []);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Failed to load your posts.");
      })
      .finally(() => {
        if (active) {
          setLoadingPosts(false);
        }
      });

    return () => {
      active = false;
    };
  }, [accessToken]);

  if (checkingSession) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-20">
        <div className="rounded-3xl border border-slate-800 bg-slate-950/75 p-6 shadow-[0_20px_80px_rgba(2,6,23,0.45)]">
          <p className="text-sm text-slate-400">Checking account session...</p>
        </div>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20">
        <section className="rounded-3xl border border-slate-800 bg-slate-950/75 p-6 shadow-[0_20px_80px_rgba(2,6,23,0.45)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-teal-300/80">My Posts</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">Sign in required</h1>
          <p className="mt-2 text-sm text-slate-400">
            Your personal uploads list is only available when you are signed in. Use your creator account, then return here to view and manage your posts.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/admin"
              className="inline-flex h-11 items-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              Go to login
            </Link>
            <Link
              href="/"
              className="inline-flex h-11 items-center rounded-full border border-slate-700 bg-slate-900 px-5 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              Back to gallery
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8 rounded-3xl border border-slate-800/80 bg-slate-950/75 p-5 shadow-[0_20px_80px_rgba(2,6,23,0.45)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-300/80">Creator Dashboard</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">My Posts</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              This page shows only the screenshots you uploaded. They are public in the gallery after you save them, but only you can edit your own records.
            </p>
            <p className="mt-2 text-sm text-slate-500">Signed in as {session?.user.email}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin"
              className="inline-flex h-10 items-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              Upload new post
            </Link>
            <Link
              href="/"
              className="inline-flex h-10 items-center rounded-full border border-slate-700 bg-slate-900 px-4 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              Public gallery
            </Link>
          </div>
        </div>
      </header>

      <div className="mb-5 flex items-center justify-between gap-3 text-sm text-slate-400">
        <p>
          {posts.length} post{posts.length === 1 ? "" : "s"}
        </p>
        {loadingPosts ? <p>Loading your posts...</p> : null}
      </div>

      {errorMessage ? (
        <div className="mb-6 rounded-2xl border border-rose-900/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
          {errorMessage}
        </div>
      ) : null}

      {!loadingPosts && posts.length === 0 ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-10 text-center shadow-[0_16px_56px_rgba(2,6,23,0.38)]">
          <p className="text-base font-medium text-slate-100">You have not published any posts yet.</p>
          <p className="mt-2 text-sm text-slate-400">
            Upload a screenshot in the creator dashboard, then save the metadata to publish it.
          </p>
          <Link
            href="/admin"
            className="mt-5 inline-flex h-10 items-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
          >
            Create your first post
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {posts.map((post) => (
            <article
              key={post.slug}
              className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-950/70 shadow-[0_16px_56px_rgba(2,6,23,0.38)]"
            >
              <div className="p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{post.date}</p>

                <ThumbnailCanvas
                  src={post.image.url}
                  crop={{
                    x: post.image.promptCrop?.x ?? DEFAULT_PROMPT_CROP.x,
                    y: post.image.promptCrop?.y ?? DEFAULT_PROMPT_CROP.y,
                    w: post.image.promptCrop?.w ?? DEFAULT_PROMPT_CROP.w,
                    h: post.image.promptCrop?.h ?? DEFAULT_PROMPT_CROP.h,
                  }}
                  alt={`Preview for ${post.title}`}
                />

                <h2 className="mt-4 text-lg font-semibold text-slate-100">{post.title}</h2>

                <div className="mt-3 flex min-h-[2.25rem] flex-wrap items-center gap-2">
                  {post.tags.slice(0, 4).map((tag) => (
                    <span
                      key={`${post.slug}-${tag}`}
                      className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-300"
                    >
                      {tag}
                    </span>
                  ))}
                  {post.topic ? (
                    <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-300">
                      {post.topic}
                    </span>
                  ) : null}
                  {post.model ? (
                    <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-300">
                      {post.model}
                    </span>
                  ) : null}
                </div>

                <dl className="mt-4 space-y-1 text-xs text-slate-500">
                  <div className="flex justify-between gap-3">
                    <dt>Created</dt>
                    <dd>{formatTimestamp(post.createdAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Updated</dt>
                    <dd>{formatTimestamp(post.updatedAt)}</dd>
                  </div>
                </dl>
              </div>

              <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-800/80 px-4 py-3">
                <Link
                  href={`/c/${post.slug}`}
                  className="inline-flex h-10 items-center rounded-full border border-slate-700 bg-slate-900 px-4 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
                >
                  View public post
                </Link>
                <Link
                  href={`/admin?slug=${encodeURIComponent(post.slug)}`}
                  className="inline-flex h-10 items-center rounded-full bg-teal-600 px-4 text-sm font-semibold text-white transition hover:bg-teal-700"
                >
                  Edit metadata
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
