"use client";

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

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(body),
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

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
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

export default function AdminPage() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<MetadataForm>(initialForm);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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

  const checkSession = useCallback(async () => {
    try {
      const result = await getJson<{ ok: boolean; authenticated: boolean }>("/api/admin/session");
      setAuthenticated(result.authenticated);
    } catch {
      setAuthenticated(false);
    } finally {
      setCheckingSession(false);
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  const tagsPreview = useMemo(() => parseTagsInput(form.tagsInput), [form.tagsInput]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetMessages();
    setIsLoggingIn(true);

    try {
      await postJson<{ ok: boolean }>("/api/admin/login", {
        password,
      });
      setAuthenticated(true);
      setPassword("");
      setStatusMessage("Logged in. You can now upload and save conversation metadata.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Login failed.");
      setAuthenticated(false);
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleLogout() {
    resetMessages();

    try {
      await postJson<{ ok: boolean }>("/api/admin/logout", {});
    } catch {
      // Ignore logout failures from stale sessions.
    }

    setAuthenticated(false);
    setFile(null);
    setForm(initialForm);
    setStatusMessage("Logged out.");
  }

  function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    resetMessages();

    if (!nextFile) {
      return;
    }

    const derived = deriveMetadataFromFilename(nextFile.name);
    setForm((previous) => ({
      ...previous,
      slug: previous.slug || derived.slug,
      date: previous.date || toDateInputValue(derived.date),
      title: previous.title || derived.title,
    }));
  }

  async function handleUploadToSupabase() {
    if (!file) {
      setErrorMessage("Select an image file before uploading.");
      return;
    }

    resetMessages();
    setIsUploading(true);

    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "png";
      const signedUpload = await postJson<UploadSignResponse>(
        "/api/admin/upload-sign",
        {
          slug: form.slug,
          extension,
        },
      );

      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.storage
        .from(signedUpload.bucket)
        .uploadToSignedUrl(signedUpload.path, signedUpload.token, file, {
          cacheControl: "31536000",
          upsert: true,
          contentType: file.type || "image/png",
        });

      if (error) {
        throw new Error(error.message);
      }

      setForm((previous) => ({
        ...previous,
        imageUrl: signedUpload.publicUrl,
      }));
      setStatusMessage("Image uploaded to Supabase Storage.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSaveMetadata() {
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

      const saveResult = await postJson<SaveResponse>("/api/admin/metadata", payload);
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
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Checking admin session...</p>
        </div>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="mx-auto max-w-xl px-4 py-20">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Private Admin</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Dialogue Diaries Uploader</h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign in with the shared admin password to upload screenshots and save metadata.
          </p>

          <form className="mt-6 space-y-4" onSubmit={(event) => void handleLogin(event)}>
            <label className="block text-sm font-medium text-slate-700">
              Admin password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 block h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                autoComplete="current-password"
                required
              />
            </label>
            <button
              type="submit"
              disabled={isLoggingIn || !password.trim()}
              className="inline-flex h-11 items-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoggingIn ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {errorMessage ? <p className="mt-4 text-sm text-rose-700">{errorMessage}</p> : null}
          {statusMessage ? <p className="mt-4 text-sm text-emerald-700">{statusMessage}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Admin</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Dialogue Diaries Uploader</h1>
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="inline-flex h-10 items-center rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
        >
          Logout
        </button>
      </header>

      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">1) Upload screenshot</h2>
          <p className="mt-1 text-sm text-slate-600">
            Select a PNG/JPG screenshot named like <code>YYYY-MM-DD__optional-title.png</code>.
          </p>
        </div>

        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
          className="block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
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
            <p className="text-sm font-medium text-slate-700">Uploaded image URL</p>
            <input
              value={form.imageUrl}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  imageUrl: event.target.value,
                }))
              }
              className="block h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
            />
            <a
              href={form.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
            >
              Open uploaded image
            </a>
          </div>
        ) : null}
      </section>

      <section className="mt-6 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">2) Metadata</h2>
          <p className="mt-1 text-sm text-slate-600">
            Edit metadata and prompt crop, then save the record to Supabase.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
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
              className="mt-1 block h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Slug
            <input
              value={form.slug}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  slug: event.target.value,
                }))
              }
              placeholder="2026-03-05-my-chat-with-gpt"
              className="mt-1 block h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
            />
          </label>
        </div>

        <label className="block text-sm font-medium text-slate-700">
          Title
          <input
            value={form.title}
            onChange={(event) =>
              setForm((previous) => ({
                ...previous,
                title: event.target.value,
              }))
            }
            className="mt-1 block h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            Tags (comma-separated)
            <input
              value={form.tagsInput}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  tagsInput: event.target.value,
                }))
              }
              placeholder="teaching, travel"
              className="mt-1 block h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Model
            <input
              value={form.model}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  model: event.target.value,
                }))
              }
              placeholder="gpt-5"
              className="mt-1 block h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Topic
            <input
              value={form.topic}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  topic: event.target.value,
                }))
              }
              placeholder="AI"
              className="mt-1 block h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
            />
          </label>
        </div>

        {tagsPreview.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tagsPreview.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div>
          <p className="text-sm font-medium text-slate-700">Prompt crop (0 to 1)</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-4">
            {([
              ["x", form.promptCrop.x],
              ["y", form.promptCrop.y],
              ["w", form.promptCrop.w],
              ["h", form.promptCrop.h],
            ] as const).map(([key, value]) => (
              <label key={key} className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {key}
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={value}
                  onChange={(event) => updateCropValue(key, event.target.value)}
                  className="mt-1 block h-10 w-full rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-900"
                />
              </label>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleSaveMetadata()}
          disabled={!canSave || isSaving}
          className="inline-flex h-10 items-center rounded-full bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save metadata"}
        </button>

        {errorMessage ? <p className="text-sm text-rose-700">{errorMessage}</p> : null}
        {statusMessage ? <p className="text-sm text-emerald-700">{statusMessage}</p> : null}
      </section>
    </main>
  );
}
