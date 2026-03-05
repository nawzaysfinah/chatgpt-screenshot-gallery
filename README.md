# ChatGPT Screenshot Gallery

Production-ready Next.js website for publishing ChatGPT conversation screenshots publicly, with private uploads/editing via Decap CMS + Netlify Identity/Git Gateway, and persistent Reddit-style voting via Cloudflare Worker + D1.

## Features

- Public gallery at `/` with search + sorting (`Newest`, `Oldest`, `Top`).
- Conversation detail pages at `/c/[slug]` with full screenshot and voting.
- Prompt-region thumbnail crops rendered client-side with `<canvas>` and cached in `localStorage`.
- Date-first display from `YYYY-MM-DD` filename prefix.
- Optional metadata (`title`, `tags`, `model`, `topic`) with runtime fallback auto-derivation from filenames.
- Private CMS at `/admin` (Decap CMS + Netlify Identity + Git Gateway).
- Persistent upvote/downvote backend with one-vote-per-user-per-conversation logic.

## Project Structure

- `app` Next.js App Router pages
- `components` UI components (`Header`, `Card`, `VoteWidget`, `ThumbnailCanvas`)
- `lib/content` content loading + metadata derivation from JSON/files
- `lib/votes` vote API client + local mock fallback
- `content/conversations` CMS-managed conversation JSON records
- `public/uploads` screenshot assets
- `public/admin` Decap CMS files
- `worker` Cloudflare Worker + D1 backend

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Run Next.js dev server:

```bash
npm run dev
```

3. Open:
- `http://localhost:3000` (public site)
- `http://localhost:3000/admin` (Decap CMS UI)

If `NEXT_PUBLIC_VOTE_API_BASE` is not set, voting automatically uses a local in-memory mock for UI development.

## Screenshot Naming Convention

Use this filename format for uploads:

`YYYY-MM-DD__optional-title.png`

Examples:
- `2026-03-05__my-chat-with-gpt.png`
- `2026-03-06__python-debug-session.png`

The app derives fallback metadata from this pattern:
- `date` from `YYYY-MM-DD`
- `title` from `optional-title`
- `slug` from date + title

## Capturing Long/Full Screenshots

- Chrome (desktop):
1. Open DevTools.
2. Run Command Menu (`Cmd/Ctrl + Shift + P`).
3. Use `Capture full size screenshot`.

- Safari (desktop):
1. Print page to PDF (`File > Export as PDF`).
2. Convert PDF page to PNG if needed before upload.

- iOS:
1. Take screenshot.
2. Tap preview.
3. Use `Full Page` when available.
4. Export/save and convert to PNG if required.

- Android:
1. Use built-in `Scrolling screenshot` or `Capture more` after a normal screenshot.
2. Save as image and upload.

## Content Model

Each conversation is a JSON file in `content/conversations`:

```json
{
  "slug": "2026-03-05-my-chat-with-gpt",
  "date": "2026-03-05",
  "title": "My Chat With GPT",
  "tags": ["teaching", "travel"],
  "model": "gpt-5.2",
  "topic": "AI",
  "image": {
    "src": "/uploads/2026-03-05__my-chat-with-gpt.png",
    "promptCrop": { "x": 0.08, "y": 0.62, "w": 0.84, "h": 0.22 }
  }
}
```

`promptCrop` uses normalized values (`0..1`) and controls thumbnail extraction.

## Netlify Deploy + Private CMS Setup

1. Push this project to GitHub.
2. In Netlify, create a new site from that GitHub repo.
3. Build settings:
- Build command: `npm run build`
- Publish directory: `.next`
4. Deploy site.
5. In Netlify dashboard, enable **Identity**.
6. Under Identity settings, set registration to **Invite only**.
7. Enable **Git Gateway**.
8. Invite your own account email in Netlify Identity.
9. Visit `/admin`, log in, and upload/update records.

This keeps gallery viewing public while editing/upload remains private.

## Voting Backend (Cloudflare Worker + D1)

Preferred persistence is Cloudflare D1 (free tier friendly for low traffic).

### 1) Set up worker project

```bash
cd worker
npm install
npx wrangler login
```

### 2) Create D1 database

```bash
npx wrangler d1 create chatgpt-screenshot-gallery-votes
```

Copy the returned `database_id` into `worker/wrangler.toml` (`[[d1_databases]]`).

### 3) Apply schema migrations

```bash
npx wrangler d1 migrations apply chatgpt-screenshot-gallery-votes --remote
```

### 4) Configure CORS allowlist

Set `ALLOWED_ORIGINS` in `worker/wrangler.toml` (or dashboard) to your Netlify URL(s), e.g.:

`https://your-site.netlify.app,https://gallery.example.com`

### 5) Deploy worker

```bash
npx wrangler deploy
```

### 6) Connect Next.js frontend to worker

In Netlify site environment variables, set:

`NEXT_PUBLIC_VOTE_API_BASE=https://your-worker-name.your-subdomain.workers.dev`

Redeploy Netlify after setting the variable.

### Optional fallback if D1 is unavailable

You can bind Cloudflare KV (`VOTES_KV`) and the same worker will fallback automatically.
Use this only when D1 is not available; KV score updates are not strictly transactional under burst traffic.

## Vote API Contract

- `POST /vote` body: `{ slug, userId, value }` where `value` is `-1`, `0`, or `1`
- `GET /score?slug=...&userId=...`
- `GET /batch-scores?slugs=a,b,c&userId=...`
- `POST /batch-scores` body: `{ slugs: string[], userId?: string }`

The frontend generates/stores a stable anonymous `userId` in `localStorage`.

## Adjusting Prompt Crop

If a thumbnail looks wrong:

1. Open the conversation JSON in Decap CMS (`/admin`) or edit the file directly.
2. Adjust `image.promptCrop` values:
- `x` (left offset)
- `y` (top offset)
- `w` (width)
- `h` (height)
3. Save/publish.
4. Refresh the gallery page.

Tip: defaults are tuned for long ChatGPT screenshots; most fixes involve `y` and `h`.

## Accessibility + UX Notes

- Keyboard-focus styling for controls.
- Labeled search, sort, and vote actions.
- Vote score updates use live region semantics.

## Seed Content Included

- `content/conversations/2026-03-05_my-chat-with-gpt.json`
- `content/conversations/2026-02-20_trip-planning-assistant.json`
- `public/uploads/2026-03-05__my-chat-with-gpt.png`
- `public/uploads/2026-02-20__trip-planning-assistant.png`
