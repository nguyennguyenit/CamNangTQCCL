# Deployment

## Platform: Cloudflare

Project deploy is split into three surfaces:

- Static site: Cloudflare Pages project at `https://tqccl.pages.dev`.
- Research MCP Worker: `https://mcp.tqccl.com`.
- Vision proxy Worker: `https://tqccl-vision-proxy.nguyennlt-ncc.workers.dev`.

## Latest Worker Deploy

- Date: 2026-10-07
- Worker: `tqccl-vision-proxy`
- Version ID: `96d4738b-fd5e-45c6-8bed-cee1ee6944b9`
- Source commit: `9efe0da` (`origin/main`); drops the legacy `ai:providers` read path (`714622c`). Worker tests 167/167 and `tsc` clean before deploy; `ai:config` confirmed present in KV `RL` first.
- Config: `ALLOWED_ORIGINS = "https://tqccl.com,https://www.tqccl.com,https://tqccl.pages.dev"`; secrets `TURNSTILE_SECRET`, `IP_HASH_SECRET`, `AI_CONFIG_SECRET`.
- Previous versions / rollback targets: `fe53709a-e455-4c76-a700-cadeecedd150` (2026-09-29), `404205e2-eb4c-4928-892f-e726dbb6a773` (`ae0932d`).
- Live verification: `OPTIONS /analyze` from `https://tqccl.com` returns 204; `POST /analyze` with a fake token for `analyzeTeamImage`, `scanHeroes`, `explainSubstitute` reaches the Turnstile check (403, no 503), so `ai:config` decrypts and every group has a route.

## Latest Static Pages Deploy

- Date: 2026-10-07
- Production URL: `https://tqccl.com` (primary). `https://www.tqccl.com` returns `301` to the same path and query through a zone Redirect Rule; `https://tqccl.pages.dev` hands over through the head bridge script.
- Deployment URL: `https://3df41c83.tqccl.pages.dev`
- Source commit: `9f2ff78` (`origin/main`). Moves 11 SP-misattached 評價 to their base heroes; lookup generation `lookup:29322cab…`, Recommended generation `a973b093…`. Builds on `e4f7225` (hero Đánh giá/Cách nhận) and `9c8c10e` (Binh thư effects), deployed earlier the same day as `2df49a17`.
- Method: `pages-deploy.yml` (workflow_dispatch, run `37600149764`). Local gate: localization `check --stage public`, `team_route_handles --check`, `build`, `verify` (3342 files), `test:dist` 32/32, `test:node` 493/493, pytest 406 passed, MCP `check:workflow-build`, lookup `test:e2e` 144/144 (full suite 414/414 on `e4f7225`).
- Production verified: `/data/lookup-manifest.json` serves `lookup:29322cab…`; `hero:sp-tuan-uc` has no Đánh giá and `hero:tuan-uc` carries the Tứ Diện Sở Ca advice.
- Previous production / rollback targets: `2df49a17` (`e4f7225`, SP-attached advice), `356b1c3d-f215-43f4-99e4-3b6517e4bc92` (`d72d6fc`).

## Latest Community Worker Deploy

- Date: 2026-10-07
- Worker: `tqccl-community` (`https://tqccl-community.nguyennlt-ncc.workers.dev`), version `b89d7f9f-dfe1-4e51-a0d7-5815d15a4933`, source `9efe0da` (legacy `ai:providers` path removed in `714622c`); `tsc` clean, vitest 129/129. Rollback target: `f0431e38-a85b-4069-91b5-13546472554e` (2026-09-29).
- Live verification: `/api/me` returns 200 directly and through `https://tqccl.com/api/me`.
- KV `RL` still holds the unused `ai:providers` key; deleting it is a separate manual step (`npx wrangler kv key delete ai:providers --namespace-id 6fff7d73c885457dbb71756de99e66fa --remote`).

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
