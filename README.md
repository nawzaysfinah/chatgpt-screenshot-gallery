# Dialogue Diaries

Dialogue Diaries is a Next.js gallery for long ChatGPT conversation screenshots.

- Public gallery: `/`
- Conversation detail pages: `/c/[slug]`
- Private uploader: `/admin`
- Owner dashboard: `/my-posts`

The project is now oriented around Vercel for hosting and route handlers, plus Supabase for metadata and image storage. The vote service remains separate and still works through the existing vote API configuration.

## Stack

- Next.js App Router + TypeScript + Tailwind
- Vercel route handlers under `app/api/admin/*`
- Supabase Postgres for conversation metadata
- Supabase Storage for screenshots
- Supabase Auth for per-user creator accounts

## How it works

### Public site

- `lib/content/load.ts` reads from Supabase when Supabase env vars are configured.
- If Supabase is not configured, it falls back to `content/conversations/*.json`.
- The gallery UI and voting UI are unchanged.

### Private admin

- `/admin` uses Supabase Auth email/password accounts.
- Each signed-in user can upload screenshots and save their own metadata.
- Metadata rows are written with `owner_id` and `owner_email`.
- A user cannot overwrite another user’s post if the slug is already claimed.
- `/my-posts` shows only the signed-in user’s own published posts and links back to edit them.
- `POST /api/admin/upload-sign` creates a signed Supabase Storage upload URL.
- The browser uploads the image directly to Supabase Storage.
- `POST /api/admin/metadata` upserts the conversation record into Supabase.

## Supabase setup

1. Create a Supabase project.
2. In `Authentication -> Providers`, enable `Email`.
3. Decide whether you want email confirmation:
   - Enabled: users must confirm their email before they can sign in.
   - Disabled: sign-up creates an immediate session.
4. In Supabase SQL editor, run [`supabase/schema.sql`](/Users/syaz/Documents/work/repos/chatgpt-screenshot-gallery/supabase/schema.sql).
5. In Supabase project settings, copy:
   - Project URL
   - anon public key
   - service role key
6. Keep the `conversation-screenshots` bucket public so the gallery can render images directly.

## Required environment variables

Set these in Vercel:

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
2. Create an account or sign in with your email and password.
3. Choose a screenshot file named like `YYYY-MM-DD__optional-title.png`.
4. Upload the file to Supabase Storage.
5. Review the auto-filled date/title/slug.
6. Adjust tags, model, topic, and `promptCrop`.
7. Save metadata.
8. Visit `/my-posts` any time to see the posts you own and jump back into editing.

Notes:

- Uploaded files are stored under a user-scoped path: `users/<user-id>/screenshots/...`
- The gallery remains public.
- Slugs are still globally unique because the public route remains `/c/[slug]`.
- If two users want the same slug, one of them must change the title or slug before saving.

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
- [`app/my-posts/page.tsx`](/Users/syaz/Documents/work/repos/chatgpt-screenshot-gallery/app/my-posts/page.tsx)
- [`app/api/admin/my-posts/route.ts`](/Users/syaz/Documents/work/repos/chatgpt-screenshot-gallery/app/api/admin/my-posts/route.ts)
- [`app/api/admin/upload-sign/route.ts`](/Users/syaz/Documents/work/repos/chatgpt-screenshot-gallery/app/api/admin/upload-sign/route.ts)
- [`app/api/admin/metadata/route.ts`](/Users/syaz/Documents/work/repos/chatgpt-screenshot-gallery/app/api/admin/metadata/route.ts)
- [`lib/content/load.ts`](/Users/syaz/Documents/work/repos/chatgpt-screenshot-gallery/lib/content/load.ts)
- [`lib/supabase/auth.ts`](/Users/syaz/Documents/work/repos/chatgpt-screenshot-gallery/lib/supabase/auth.ts)
- [`lib/supabase/server.ts`](/Users/syaz/Documents/work/repos/chatgpt-screenshot-gallery/lib/supabase/server.ts)
- [`supabase/schema.sql`](/Users/syaz/Documents/work/repos/chatgpt-screenshot-gallery/supabase/schema.sql)
