# Dialogue Diaries

Dialogue Diaries is a Next.js gallery for long ChatGPT conversation screenshots.

- Public gallery: `/`
- Conversation detail pages: `/c/[slug]`
- Private uploader: `/admin`

The project is now oriented around Vercel for hosting and route handlers, plus Supabase for metadata and image storage. The vote service remains separate and still works through the existing vote API configuration.

## Stack

- Next.js App Router + TypeScript + Tailwind
- Vercel route handlers under `app/api/admin/*`
- Supabase Postgres for conversation metadata
- Supabase Storage for screenshots
- Shared admin password stored in Vercel environment variables

## How it works

### Public site

- `lib/content/load.ts` reads from Supabase when Supabase env vars are configured.
- If Supabase is not configured, it falls back to `content/conversations/*.json`.
- The gallery UI and voting UI are unchanged.

### Private admin

- `/admin` uses a shared password.
- `POST /api/admin/login` verifies `ADMIN_PASSWORD` and sets an `HttpOnly` cookie.
- `POST /api/admin/upload-sign` creates a signed Supabase Storage upload URL.
- The browser uploads the image directly to Supabase Storage.
- `POST /api/admin/metadata` upserts the conversation record into Supabase.

## Supabase setup

1. Create a Supabase project.
2. In Supabase SQL editor, run [`supabase/schema.sql`](/Users/syaz/Documents/work/repos/chatgpt-screenshot-gallery/supabase/schema.sql).
3. In Supabase project settings, copy:
   - Project URL
   - anon public key
   - service role key
4. Keep the `conversation-screenshots` bucket public so the gallery can render images directly.

## Required environment variables

Set these in Vercel:

- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET`

Optional:

- `NEXT_PUBLIC_VOTE_API_BASE`

If you do not set `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET`, the app defaults to `conversation-screenshots`.

## Vercel deployment

1. Push the repo to GitHub.
2. Import the repo into Vercel.
3. Set the environment variables listed above.
4. Deploy.

No `netlify.toml` or Netlify Functions are required anymore. The app uses standard Next.js route handlers, which Vercel supports directly.

## Local development

```bash
npm install
npm run dev
```

Open:

- `http://localhost:3000`
- `http://localhost:3000/admin`

Local notes:

- If Supabase env vars are missing, the public gallery falls back to local JSON content.
- The admin upload flow requires Supabase env vars because uploads and metadata writes now target Supabase directly.

## Admin workflow

1. Visit `/admin`.
2. Enter the shared admin password.
3. Choose a screenshot file named like `YYYY-MM-DD__optional-title.png`.
4. Upload the file to Supabase Storage.
5. Review the auto-filled date/title/slug.
6. Adjust tags, model, topic, and `promptCrop`.
7. Save metadata.

## Metadata format

```json
{
  "slug": "2026-03-05-my-chat-with-gpt",
  "date": "2026-03-05",
  "title": "My Chat With GPT",
  "tags": ["teaching", "travel"],
  "model": "gpt-5",
  "topic": "AI",
  "image": {
    "url": "https://your-project.supabase.co/storage/v1/object/public/conversation-screenshots/screenshots/2026-03-05-my-chat-with-gpt.png",
    "promptCrop": { "x": 0.08, "y": 0.62, "w": 0.84, "h": 0.22 }
  }
}
```

The gallery accepts both the new `image.url` shape from Supabase and older `image.src` records.

## Files that matter

- [`app/admin/page.tsx`](/Users/syaz/Documents/work/repos/chatgpt-screenshot-gallery/app/admin/page.tsx)
- [`app/api/admin/login/route.ts`](/Users/syaz/Documents/work/repos/chatgpt-screenshot-gallery/app/api/admin/login/route.ts)
- [`app/api/admin/logout/route.ts`](/Users/syaz/Documents/work/repos/chatgpt-screenshot-gallery/app/api/admin/logout/route.ts)
- [`app/api/admin/session/route.ts`](/Users/syaz/Documents/work/repos/chatgpt-screenshot-gallery/app/api/admin/session/route.ts)
- [`app/api/admin/upload-sign/route.ts`](/Users/syaz/Documents/work/repos/chatgpt-screenshot-gallery/app/api/admin/upload-sign/route.ts)
- [`app/api/admin/metadata/route.ts`](/Users/syaz/Documents/work/repos/chatgpt-screenshot-gallery/app/api/admin/metadata/route.ts)
- [`lib/content/load.ts`](/Users/syaz/Documents/work/repos/chatgpt-screenshot-gallery/lib/content/load.ts)
- [`lib/supabase/server.ts`](/Users/syaz/Documents/work/repos/chatgpt-screenshot-gallery/lib/supabase/server.ts)
- [`supabase/schema.sql`](/Users/syaz/Documents/work/repos/chatgpt-screenshot-gallery/supabase/schema.sql)

