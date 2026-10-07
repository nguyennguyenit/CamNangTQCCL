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

- Date: 2026-10-07
- Production URL: `https://tqccl.com` (primary). `https://www.tqccl.com` returns `301` to the same path and query through a zone Redirect Rule; `https://tqccl.pages.dev` hands over through the head bridge script.
- Deployment URL: `https://3df41c83.tqccl.pages.dev`
- Source commit: `9f2ff78` (`origin/main`). Moves 11 SP-misattached 評價 to their base heroes; lookup generation `lookup:29322cab…`, Recommended generation `a973b093…`. Builds on `e4f7225` (hero Đánh giá/Cách nhận) and `9c8c10e` (Binh thư effects), deployed earlier the same day as `2df49a17`.
- Method: `pages-deploy.yml` (workflow_dispatch, run `37600149764`). Local gate: localization `check --stage public`, `team_route_handles --check`, `build`, `verify` (3342 files), `test:dist` 32/32, `test:node` 493/493, pytest 406 passed, MCP `check:workflow-build`, lookup `test:e2e` 144/144 (full suite 414/414 on `e4f7225`).
- Production verified: `/data/lookup-manifest.json` serves `lookup:29322cab…`; `hero:sp-tuan-uc` has no Đánh giá and `hero:tuan-uc` carries the Tứ Diện Sở Ca advice.
- Previous production / rollback targets: `2df49a17` (`e4f7225`, SP-attached advice), `356b1c3d-f215-43f4-99e4-3b6517e4bc92` (`d72d6fc`).

## Latest Community Worker Deploy

- Date: 2026-09-28
- Worker: `tqccl-community` (`https://tqccl-community.nguyennlt-ncc.workers.dev`), version `576f5f6e-df58-4a88-9726-e1653b656dc5`, source `ad2ceb7`; `tsc` clean, vitest 46/46.
- Secrets set: `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Not yet set: `QWEN_API_KEY` (battle-report AI reading returns 503), `GITHUB_DISPATCH_TOKEN` (blog publish does not trigger `pages-deploy.yml`).

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

- `ALLOWED_ORIGINS`
- `FEATURE_ENABLED`
- `RL_PER_HOUR`
- `DAILY_CAP`
- `MONTHLY_CAP`
- `MAX_IMAGE_BYTES`

Worker secrets are managed in Cloudflare and must not be committed:

- `TURNSTILE_SECRET`
- `IP_HASH_SECRET`
- `AI_CONFIG_SECRET` (same value as `community-worker/`)

AI configuration (shared providers with endpoint + API key, and per-feature failover chains of provider, model,
effort, timeout and total budget) is not in env vars: admins manage it in the **AI** tab of `/quan-tri/`;
`community-worker/` stores it encrypted in KV `ai:config` (namespace `RL`, binding `AI_KV`) and `worker/` reads the
same record. Details: [community-worker.md](community-worker.md#cấu-hình-ai-tab-ai).

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
