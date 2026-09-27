# Deployment

## Platform: Cloudflare

Project deploy is split into three surfaces:

- Static site: Cloudflare Pages project at `https://tqccl.pages.dev`.
- Research MCP Worker: `https://mcp.tqccl.com`.
- Vision proxy Worker: `https://tqccl-vision-proxy.nguyennlt-ncc.workers.dev`.

## Latest Worker Deploy

- Date: 2026-09-27
- Worker: `tqccl-vision-proxy`
- Version ID: `404205e2-eb4c-4928-892f-e726dbb6a773`
- Source commit: `ae0932d` (clean worktree of `origin/main`); Worker tests 104/104 passed before deploy.
- Config: `ALLOWED_ORIGINS = "https://tqccl.com,https://www.tqccl.com,https://tqccl.pages.dev"`; secrets `QWEN_API_KEY`, `TURNSTILE_SECRET`, `IP_HASH_SECRET`.
- Previous versions / rollback targets: `1e0a3b95-f14a-4151-9dca-8f81931d9460` (`877adf1`, single origin), `454cf5e5-9148-441c-a9b6-423f4c3428f6` (`7bf5797`).
- Live verification: each of the three origins gets its own `Access-Control-Allow-Origin` plus `Vary: Origin` and reaches the Turnstile check (403 on a fake token, no 503); a foreign origin gets 403 "Origin không được phép"; a 3 MB body gets 413 with CORS.
- Turnstile widget hostnames include `tqccl.com`, `www.tqccl.com`, `tqccl.pages.dev` (dashboard, 2026-09-27); a headless load of the Gợi ý đội page on each host rendered the widget without error 110200.

## Latest Static Pages Deploy

- Date: 2026-09-27
- Production URL: `https://tqccl.com` (primary; `https://www.tqccl.com` and `https://tqccl.pages.dev` hand over to it through the head bridge script)
- Deployment URL: `https://d3b75ea5.tqccl.pages.dev`
- Deployment ID: `d3b75ea5-86fa-46c8-9917-596d30808b89`
- Source commit: `7422a5d` (clean worktree of `origin/main`; CI run `36333537098` green, 329 e2e passed)
- Method: Wrangler direct upload of `dist/` after `npm run build` and `npm run verify` (1725 files).
- Preview verified: `https://2809167a.tqccl.pages.dev` (alias `https://release-260927b.tqccl.pages.dev`)
- Previous production / rollback targets: `c72f8f75-4028-4572-82c2-709f52b7ec76` (`877adf1`, same day, canonical still `tqccl.pages.dev`), `4e35bd85-0759-4e39-ae20-e785300c9757` (`0a57801`).
- Verification: `https://tqccl.pages.dev/theo-doi-chieu-mo/?x=1` lands on `https://tqccl.com/theo-doi-chieu-mo/?x=1` and carries `tqcclRecruitTracker` and `theme`; a key that already exists on `tqccl.com` is not overwritten; `https://www.tqccl.com/#analyze` ends on `https://tqccl.com/soi-doi-tu-anh/`; canonical, `robots.txt` and `sitemap.xml` use `https://tqccl.com`; no page errors.
- Earlier the same day: `c72f8f75` (`877adf1`) replaced the 2-week-old `4e35bd85`; preview `7bcc5c60` passed 12 routes, headers, 404s, sitemap (1558 URLs) and 10 legacy hash redirects.

## Latest Research MCP Deploy

- Date: 2026-08-25
- Production URL: `https://mcp.tqccl.com`
- GitHub Actions run: `32772255629`
- Source commit: `2a754f5a4508695dd7871bf72fd348117f9aeba3`
- Release ID: `sha256:a3db20b188b1e8d03b5815301de6d7b9633fc441af103276539dfc9611ba42fa`
- Workflow build ID: `build:sha256b64:9Y0VOcHk5jF71B_4OkFKQny0b6FVXlU1PS8-5ypWJik`
- Worker version ID: `8264ea76-efc2-4cd5-b446-49a03a89184d`
- Production deployment ID: `44f7d0c4-1b4f-487d-acb1-00596400843b`
- Status: verified at 100% traffic

## Deploy Commands

Static site uses Cloudflare Pages direct upload from a verified, clean `main` checkout.
Follow the preview and production checks in [the deployment guide](deployment-guide.md).
After verification, upload `dist/` with `wrangler pages deploy dist --project-name tqccl --branch main --commit-hash <verified-sha>`.

Research MCP production deploys only through the manual exact-SHA workflow in
`.github/workflows/mcp-worker.yml`. A push to `main` runs the credential-free
release gate but does not deploy production.

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

For Research MCP rollback, use the verified deployment evidence from the exact-SHA
workflow and restore the prior Worker version through the same controlled release path.
