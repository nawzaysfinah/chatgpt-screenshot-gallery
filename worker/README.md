# Vote Worker (Cloudflare + D1)

This worker exposes:
- `POST /vote`
- `GET /score?slug=...&userId=...`
- `GET|POST /batch-scores`

## Quick start

```bash
npm install
npx wrangler login
npx wrangler d1 create chatgpt-screenshot-gallery-votes
# copy database_id into wrangler.toml
npx wrangler d1 migrations apply chatgpt-screenshot-gallery-votes --remote
npx wrangler deploy
```

Set `ALLOWED_ORIGINS` in `wrangler.toml` (or via Cloudflare dashboard) to your Netlify domain.

## Optional KV fallback

If D1 is not available, you can bind a KV namespace as `VOTES_KV` in `wrangler.toml`.
The worker will auto-fallback to KV, but KV updates are not fully transactional under heavy concurrency.
