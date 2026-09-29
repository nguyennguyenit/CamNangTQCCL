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

- Date: 2026-09-28
- Production URL: `https://tqccl.com` (primary). `https://www.tqccl.com` returns `301` to the same path and query through a zone Redirect Rule; `https://tqccl.pages.dev` hands over through the head bridge script.
- Deployment URL: `https://3a856c2d.tqccl.pages.dev`
- Deployment ID: `3a856c2d-f1ef-4d79-8d0f-9efd75f103c2`
- Source commit: `ad2ceb7` (clean `main` = `origin/main`; CI run `36334247045` green on `9a2dc7e`, later commits docs-only). First release with the `/zh/` mirror, community features, blog, privacy page and book logo.
- Method: `COMMUNITY_API_ORIGIN=https://tqccl-community.nguyennlt-ncc.workers.dev npm run build`, `npm run verify` (3305 files), Wrangler direct upload from the repository root so `functions/api/[[path]].ts` ships with the site. Pages service binding `COMMUNITY` → `tqccl-community`.
- Preview verified: `https://fb5ec929.tqccl.pages.dev` (alias `https://release-260928.tqccl.pages.dev`): 21 routes incl. `/zh/`, `/chien-bao/`, `/quan-tri/`, `/bai-viet/`, `/chinh-sach-bao-mat/`, `/rss.xml`, `/llms.txt`, `/api/me`, `/api/posts`, 404; canonical `https://tqccl.com/`; Chromium load of landing, zh landing, Đội chuẩn, zh Đội khác, Tra cứu, Khai hoang and a team detail with its community section, no page errors.
- Production verified: `/`, `/zh/`, `/chinh-sach-bao-mat/`, `/bai-viet/`, `/api/me`, `/logo.png` return 200; `https://www.tqccl.com/zh/` → 301 `https://tqccl.com/zh/`; Google sign-in start on `tqccl.com` returns redirect URI `https://tqccl.com/api/auth/callback/google`.
- Previous production / rollback targets: `d3b75ea5-86fa-46c8-9917-596d30808b89` (`7422a5d`, primary-domain release), `c72f8f75-4028-4572-82c2-709f52b7ec76` (`877adf1`).

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
same record. Rollout order from the legacy `ai:providers` record and details:
[community-worker.md](community-worker.md#cấu-hình-ai-tab-ai).

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
