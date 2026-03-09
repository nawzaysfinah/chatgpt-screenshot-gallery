"use client";

import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { DEFAULT_PROMPT_CROP } from "@/lib/content/constants";
import { deriveMetadataFromFilename, parseTagsInput } from "@/lib/admin/metadata";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type PromptCrop = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type UploadSignResponse = {
  ok: boolean;
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
  publicUrl: string;
};

type SaveResponse = {
  ok: boolean;
  message: string;
  slug?: string;
};

type ExistingMetadataResponse = {
  ok: boolean;
  conversation: {
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
  };
};

type MetadataForm = {
  slug: string;
  date: string;
  title: string;
  tagsInput: string;
  model: string;
  topic: string;
  imageUrl: string;
  promptCrop: PromptCrop;
};

type AuthMode = "sign-in" | "sign-up";

const initialForm: MetadataForm = {
  slug: "",
  date: "",
  title: "",
  tagsInput: "",
  model: "",
  topic: "",
  imageUrl: "",
  promptCrop: {
    x: DEFAULT_PROMPT_CROP.x,
    y: DEFAULT_PROMPT_CROP.y,
    w: DEFAULT_PROMPT_CROP.w,
    h: DEFAULT_PROMPT_CROP.h,
  },
};

function toDateInputValue(raw: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

function authHeaders(token: string | null, withJsonBody = false): HeadersInit {
  const headers: HeadersInit = {};

  if (withJsonBody) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function requestJson<T>(
  url: string,
  options?: {
    method?: "GET" | "POST";
    token?: string | null;
    body?: unknown;
  },
): Promise<T> {
  const response = await fetch(url, {
    method: options?.method ?? "GET",
    cache: "no-store",
    headers: authHeaders(options?.token ?? null, options?.body !== undefined),
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof payload?.message === "string"
        ? payload.message
        : typeof payload?.error === "string"
          ? payload.error
          : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}

async function getOptionalJson<T>(url: string, token: string | null): Promise<T | null> {
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: authHeaders(token),
  });

  if (response.status === 404) {
    return null;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof payload?.message === "string"
        ? payload.message
        : typeof payload?.error === "string"
          ? payload.error
          : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}

function defaultSlugForFile(file: File): string {
  const derived = deriveMetadataFromFilename(file.name);
  return derived.slug || file.name.replace(/\.[^.]+$/, "").toLowerCase();
}

export default function AdminPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [checkingSession, setCheckingSession] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<MetadataForm>(initialForm);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [requestedSlug, setRequestedSlug] = useState("");

  const authenticated = Boolean(session?.user);
  const accessToken = session?.access_token ?? null;
  const tagsPreview = useMemo(() => parseTagsInput(form.tagsInput), [form.tagsInput]);
  const canUpload = authenticated && Boolean(file);
  const canSave =
    authenticated &&
    Boolean(form.imageUrl.trim()) &&
    Boolean(form.slug.trim()) &&
    Boolean(form.title.trim()) &&
    Boolean(form.date.trim());

  const resetMessages = useCallback(() => {
    setErrorMessage(null);
    setStatusMessage(null);
  }, []);

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
    if (typeof window === "undefined") {
      return;
    }

    const slug = new URLSearchParams(window.location.search).get("slug")?.trim().toLowerCase() ?? "";
    setRequestedSlug(slug);
  }, []);

  useEffect(() => {
    if (!authenticated || !accessToken || !requestedSlug) {
      return;
    }

    void loadExistingMetadata(requestedSlug);
  }, [accessToken, authenticated, requestedSlug]);

  async function loadExistingMetadata(slug: string) {
    const safeSlug = slug.trim().toLowerCase();
    if (!safeSlug || !accessToken) {
      return;
    }

    try {
      const existing = await getOptionalJson<ExistingMetadataResponse>(
        `/api/admin/metadata?slug=${encodeURIComponent(safeSlug)}`,
        accessToken,
      );
      if (!existing?.conversation) {
        return;
      }

      const conversation = existing.conversation;
      setForm((previous) => ({
        ...previous,
        slug: conversation.slug,
        date: conversation.date,
        title: conversation.title,
        tagsInput: conversation.tags.join(", "),
        model: conversation.model,
        topic: conversation.topic,
        imageUrl: conversation.image.url,
        promptCrop: {
          x: conversation.image.promptCrop?.x ?? previous.promptCrop.x,
          y: conversation.image.promptCrop?.y ?? previous.promptCrop.y,
          w: conversation.image.promptCrop?.w ?? previous.promptCrop.w,
          h: conversation.image.promptCrop?.h ?? previous.promptCrop.h,
        },
      }));
      setStatusMessage(`Loaded your existing metadata for ${conversation.slug}. Saving will update it.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load existing metadata.");
    }
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetMessages();
    setIsSubmittingAuth(true);

    try {
      if (authMode === "sign-up") {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        setPassword("");
        setConfirmPassword("");

        if (data.session) {
          setStatusMessage("Account created. You can upload screenshots now.");
        } else {
          setStatusMessage("Account created. Check your email for the confirmation link, then sign in.");
          setAuthMode("sign-in");
        }

        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      setPassword("");
      setConfirmPassword("");
      setStatusMessage("Signed in. You can now upload and save screenshots.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setIsSubmittingAuth(false);
    }
  }

  async function handleLogout() {
    resetMessages();

    const { error } = await supabase.auth.signOut();
    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setFile(null);
    setForm(initialForm);
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setStatusMessage("Signed out.");
  }

  function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    resetMessages();

    if (!nextFile) {
      return;
    }

    const derived = deriveMetadataFromFilename(nextFile.name);
    const derivedSlug = derived.slug;
    setForm((previous) => ({
      ...previous,
      slug: previous.slug || derivedSlug,
      date: previous.date || toDateInputValue(derived.date),
      title: previous.title || derived.title,
    }));

    if (derivedSlug && accessToken) {
      void loadExistingMetadata(derivedSlug);
    }
  }

  async function handleUploadToSupabase() {
    if (!file) {
      setErrorMessage("Select an image file before uploading.");
      return;
    }

    if (!accessToken) {
      setErrorMessage("You need to be signed in before uploading.");
      return;
    }

    resetMessages();
    setIsUploading(true);

    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "png";
      const uploadSlug = form.slug.trim() || defaultSlugForFile(file);
      const signedUpload = await requestJson<UploadSignResponse>("/api/admin/upload-sign", {
        method: "POST",
        token: accessToken,
        body: {
          slug: uploadSlug,
          extension,
        },
      });

      const { error } = await supabase.storage.from(signedUpload.bucket).uploadToSignedUrl(
        signedUpload.path,
        signedUpload.token,
        file,
        {
          cacheControl: "31536000",
          upsert: true,
          contentType: file.type || "image/png",
        },
      );

      if (error) {
        const lowerMessage = error.message.toLowerCase();
        if (lowerMessage.includes("already exists")) {
          setForm((previous) => ({
            ...previous,
            imageUrl: signedUpload.publicUrl,
          }));
          await loadExistingMetadata(uploadSlug);
          setStatusMessage(
            "This screenshot already exists in your storage path. Loaded your saved record below. Review it and save again if you want to update the metadata.",
          );
          return;
        }

        throw new Error(error.message);
      }

      setForm((previous) => ({
        ...previous,
        slug: previous.slug || uploadSlug,
        imageUrl: signedUpload.publicUrl,
      }));
      setStatusMessage("Image uploaded to Supabase Storage. Click Save metadata to publish it in the gallery.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSaveMetadata() {
    if (!accessToken) {
      setErrorMessage("You need to be signed in before saving.");
      return;
    }

    resetMessages();
    setIsSaving(true);

    try {
      const payload = {
        slug: form.slug,
        date: form.date,
        title: form.title,
        tags: parseTagsInput(form.tagsInput),
        model: form.model,
        topic: form.topic,
        image: {
          url: form.imageUrl,
          promptCrop: form.promptCrop,
        },
      };

      const saveResult = await requestJson<SaveResponse>("/api/admin/metadata", {
        method: "POST",
        token: accessToken,
        body: payload,
      });

      setForm((previous) => ({
        ...previous,
        slug: saveResult.slug ?? previous.slug,
      }));
      setStatusMessage(saveResult.message || "Metadata saved.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Metadata save failed.");
    } finally {
      setIsSaving(false);
    }
  }

  function updateCropValue(key: keyof PromptCrop, value: string) {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
      return;
    }

    setForm((previous) => ({
      ...previous,
      promptCrop: {
        ...previous.promptCrop,
        [key]: Math.max(0, Math.min(1, parsed)),
      },
    }));
  }

  if (checkingSession) {
    return (
      <main className="mx-auto max-w-xl px-4 py-20">
        <div className="rounded-3xl border border-slate-800 bg-slate-950/75 p-6 shadow-[0_20px_80px_rgba(2,6,23,0.45)]">
          <p className="text-sm text-slate-400">Checking account session...</p>
        </div>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="mx-auto max-w-xl px-4 py-20">
        <section className="rounded-3xl border border-slate-800 bg-slate-950/75 p-6 shadow-[0_20px_80px_rgba(2,6,23,0.45)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-teal-300/80">Creator Login</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">Dialogue Diaries</h1>
          <p className="mt-2 text-sm text-slate-400">
            Create your own account or sign in to upload screenshots. Each saved post is owned by the signed-in user. If Supabase email confirmation is enabled, you will need to confirm your email before signing in.
          </p>

          <div className="mt-6 inline-flex rounded-full border border-slate-800 bg-slate-900 p-1">
            <button
              type="button"
              onClick={() => setAuthMode("sign-in")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                authMode === "sign-in"
                  ? "bg-emerald-700 text-white"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setAuthMode("sign-up")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                authMode === "sign-up"
                  ? "bg-emerald-700 text-white"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Create account
            </button>
          </div>

          <form className="mt-6 space-y-4" onSubmit={(event) => void handleAuthSubmit(event)}>
            <label className="block text-sm font-medium text-slate-300">
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 block h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                autoComplete={authMode === "sign-in" ? "email" : "username"}
                required
              />
            </label>

            <label className="block text-sm font-medium text-slate-300">
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 block h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                autoComplete={authMode === "sign-in" ? "current-password" : "new-password"}
                required
              />
            </label>

            {authMode === "sign-up" ? (
              <label className="block text-sm font-medium text-slate-300">
                Confirm password
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="mt-1 block h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  autoComplete="new-password"
                  required
                />
              </label>
            ) : null}

            <button
              type="submit"
              disabled={
                isSubmittingAuth ||
                !email.trim() ||
                !password.trim() ||
                (authMode === "sign-up" && !confirmPassword.trim())
              }
              className="inline-flex h-11 items-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmittingAuth
                ? authMode === "sign-in"
                  ? "Signing in..."
                  : "Creating account..."
                : authMode === "sign-in"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>

          {errorMessage ? <p className="mt-4 text-sm text-rose-400">{errorMessage}</p> : null}
          {statusMessage ? <p className="mt-4 text-sm text-emerald-400">{statusMessage}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-800 bg-slate-950/75 p-5 shadow-[0_20px_80px_rgba(2,6,23,0.45)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-teal-300/80">Creator Dashboard</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-100">Dialogue Diaries</h1>
          <p className="mt-2 text-sm text-slate-400">Signed in as {session?.user.email}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/my-posts"
            className="inline-flex h-10 items-center rounded-full border border-slate-700 bg-slate-900 px-4 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
          >
            My Posts
          </Link>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="inline-flex h-10 items-center rounded-full border border-slate-700 bg-slate-900 px-4 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
          >
            Logout
          </button>
        </div>
      </header>

      <section className="space-y-5 rounded-3xl border border-slate-800 bg-slate-950/75 p-5 shadow-[0_20px_80px_rgba(2,6,23,0.45)] sm:p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">1) Upload screenshot</h2>
          <p className="mt-1 text-sm text-slate-400">
            Select a PNG/JPG screenshot named like <code>YYYY-MM-DD__optional-title.png</code>. Uploading only stores the file in your user-scoped storage path. It does not appear in the gallery until you save metadata in step 2.
          </p>
        </div>

        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
          className="block w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
        />

        <button
          type="button"
          onClick={() => void handleUploadToSupabase()}
          disabled={!canUpload || isUploading}
          className="inline-flex h-10 items-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isUploading ? "Uploading..." : "Upload to Supabase Storage"}
        </button>

        {form.imageUrl ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-300">Uploaded image URL</p>
            <input
              value={form.imageUrl}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  imageUrl: event.target.value,
                }))
              }
              className="block h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200"
            />
            <a
              href={form.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
            >
              Open uploaded image
            </a>
          </div>
        ) : null}
      </section>

      <section className="mt-6 space-y-5 rounded-3xl border border-slate-800 bg-slate-950/75 p-5 shadow-[0_20px_80px_rgba(2,6,23,0.45)] sm:p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">2) Metadata</h2>
          <p className="mt-1 text-sm text-slate-400">
            Edit metadata and prompt crop, then save the record to Supabase. If the slug already belongs to another account, saving is blocked so one user cannot overwrite another user&apos;s post.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-300">
            Date
            <input
              type="date"
              value={form.date}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  date: event.target.value,
                }))
              }
              className="mt-1 block h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100"
            />
          </label>

          <label className="text-sm font-medium text-slate-300">
            Slug
            <input
              value={form.slug}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  slug: event.target.value,
                }))
              }
              className="mt-1 block h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100"
            />
          </label>

          <label className="sm:col-span-2 text-sm font-medium text-slate-300">
            Title
            <input
              value={form.title}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  title: event.target.value,
                }))
              }
              className="mt-1 block h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100"
            />
          </label>

          <label className="sm:col-span-2 text-sm font-medium text-slate-300">
            Tags (comma-separated)
            <input
              value={form.tagsInput}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  tagsInput: event.target.value,
                }))
              }
              className="mt-1 block h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100"
            />
          </label>

          <label className="text-sm font-medium text-slate-300">
            Model
            <input
              value={form.model}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  model: event.target.value,
                }))
              }
              className="mt-1 block h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100"
            />
          </label>

          <label className="text-sm font-medium text-slate-300">
            Topic
            <input
              value={form.topic}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  topic: event.target.value,
                }))
              }
              className="mt-1 block h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100"
            />
          </label>
        </div>

        {tagsPreview.length ? (
          <div className="flex flex-wrap gap-2">
            {tagsPreview.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-300"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-400">Prompt crop</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-4">
            {(["x", "y", "w", "h"] as const).map((key) => (
              <label key={key} className="text-sm font-medium capitalize text-slate-300">
                {key}
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={form.promptCrop[key]}
                  onChange={(event) => updateCropValue(key, event.target.value)}
                  className="mt-1 block h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100"
                />
              </label>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleSaveMetadata()}
          disabled={!canSave || isSaving}
          className="inline-flex h-11 items-center rounded-full bg-teal-600 px-5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save metadata"}
        </button>

        {errorMessage ? <p className="text-sm text-rose-400">{errorMessage}</p> : null}
        {statusMessage ? <p className="text-sm text-emerald-400">{statusMessage}</p> : null}
      </section>
    </main>
  );
}
