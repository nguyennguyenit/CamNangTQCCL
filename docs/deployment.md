# Deployment

## Platform: Cloudflare

Project deploy is split into three surfaces:

- Static site: Cloudflare Pages project at `https://tqccl.pages.dev`.
- Research MCP Worker: `https://mcp.tqccl.com`.
- Vision proxy Worker: `https://tqccl-vision-proxy.nguyennlt-ncc.workers.dev`.

## Latest Worker Deploy

- Date: 2026-09-27
- Worker: `tqccl-vision-proxy`
- Version ID: `1e0a3b95-f14a-4151-9dca-8f81931d9460`
- Source commit: `877adf1` (clean worktree of `origin/main`); Worker tests 85/85 and typecheck passed before deploy.
- Secrets: `QWEN_API_KEY`, `TURNSTILE_SECRET`, `IP_HASH_SECRET` (the last one set on 2026-09-27, secret-change version `454cf5e5-9148-441c-a9b6-423f4c3428f6`).
- Previous version / rollback target: `454cf5e5-9148-441c-a9b6-423f4c3428f6` (code from `7bf5797`).
- Live verification: `OPTIONS /analyze` from `https://tqccl.pages.dev` → 204 with CORS; `POST` with an invalid Turnstile token → 403 "Xác thực chống bot thất bại" (secret present, no 503); foreign origin → 403; 3 MB body → 413 with CORS before any KV or siteverify call.
- Known gap: `https://tqccl.com` and `https://www.tqccl.com` are attached to the Pages project, but `ALLOWED_ORIGIN` is `https://tqccl.pages.dev`, so Vision requests from those hosts return 403.

## Latest Static Pages Deploy

- Date: 2026-09-27
- Production URL: `https://tqccl.pages.dev` (also served on `https://tqccl.com`, `https://www.tqccl.com`)
- Deployment URL: `https://c72f8f75.tqccl.pages.dev`
- Deployment ID: `c72f8f75-4028-4572-82c2-709f52b7ec76`
- Source commit: `877adf1` (clean worktree of `origin/main`; CI run `36322467887` green, 324 e2e passed)
- Method: Wrangler direct upload of `dist/` after `npm run build` and `npm run verify` (1725 files).
- Preview verified: `https://7bcc5c60.tqccl.pages.dev` (alias `https://release-260927.tqccl.pages.dev`)
- Previous production / rollback target: `4e35bd85-0759-4e39-ae20-e785300c9757` (`0a57801`)
- Verification: 12 section/detail routes 200 with `public, max-age=0, must-revalidate`; unknown, private and retired paths (`/teams/…`, `/_headers`, `/pipeline/…`) 404 `no-store`; `robots.txt` points at the production sitemap; `sitemap.xml` 1558 URLs; 10 legacy hash links (`/#analyze`, `/#team-pk`, …) redirect to the new paths; no page errors on 10 pages; the same routes return 200 on all three hosts after promotion.

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
