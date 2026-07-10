# Deployment

## Platform: Cloudflare

Project deploy is split into two surfaces:

- Static site: Cloudflare Pages project at `https://tqccl.pages.dev`.
- Vision proxy Worker: `https://tqccl-vision-proxy.nguyennlt-ncc.workers.dev`.

## Latest Worker Deploy

- Date: 2026-07-11
- Worker: `tqccl-vision-proxy`
- Version ID: `47bff736-95ab-4a51-88c7-514c0cb7b88b`
- Source commit deployed from local main: `7bf5797`

## Latest Static Pages Deploy

- Date: 2026-07-11
- Production URL: `https://tqccl.pages.dev`
- Preview URL: `https://29ebe76f.tqccl.pages.dev`
- Source commit deployed from local main: `b8c48d9`
- Published files: `index.html`, `css/`, `js/`, `data/`

## Deploy Commands

Static site is expected to deploy from `main` through Cloudflare Pages.

Worker deploy:

```bash
cd worker
npm test
npm run typecheck
npm run deploy
```

## Environment Variables

Worker config uses non-secret vars from `worker/wrangler.toml`:

- `ALLOWED_ORIGIN`
- `REGION`
- `MODEL_ID`
- `FEATURE_ENABLED`
- `RL_PER_HOUR`
- `DAILY_CAP`
- `MONTHLY_CAP`
- `MAX_IMAGE_BYTES`

Worker secrets are managed in Cloudflare and must not be committed:

- `QWEN_API_KEY`
- `TURNSTILE_SECRET`

## Verification

```bash
curl -i -X OPTIONS \
  https://tqccl-vision-proxy.nguyennlt-ncc.workers.dev/analyze \
  -H 'Origin: https://tqccl.pages.dev'
```

Expected: `204` with `access-control-allow-origin: https://tqccl.pages.dev`.

## Rollback

Use Cloudflare dashboard rollback for the Worker version or deploy a known-good commit from `worker/`.

For static Pages rollback, use Cloudflare Pages deployment history for `tqccl.pages.dev`.
