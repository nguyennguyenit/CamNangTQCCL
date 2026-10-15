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

- Date: 2026-10-15
- Production URL: `https://tqccl.com` (primary). `https://www.tqccl.com` returns `301` to the same path and query through a zone Redirect Rule; `https://tqccl.pages.dev` hands over through the head bridge script.
- Deployment URL: `https://ff01ace5.tqccl.pages.dev`
- Source commit: `a9f055e` (`origin/main`, fast-forward of `feat/mcp-skill-redesign`). MCP skill redesign plus Gợi ý kho adapter fixes; the "Dùng món này" substitute button is enabled again (it carried `disabled="false"`). Recommended generation `e079390c…`.
- Method: local `wrangler pages deploy dist --branch main --commit-hash a9f055e…` from a clean worktree, same `dist/` first deployed as preview `https://74b7c3b6.tqccl.pages.dev` (branch `release-a9f055e`). Build used `COMMUNITY_API_ORIGIN` like `pages-deploy.yml`. Local gate: localization `check --stage public`, `team_route_handles --check`, `build`, `verify` (3343 files), `test:dist` 32/32, `test:node` 540/540, pytest 393 passed, MCP `check` 526/526, `check:repository` Playwright 414/414.
- Preview verified: shell, three team families, `/goi-y-doi-tu-kho/`, `/tra-cuu/` 200; unknown team, `/teams/…`, `pipeline/…` and `/_headers` 404 `no-store`; `/robots.txt` byte-equal to source; `/sitemap.xml` `application/xml`, 3140 URLs as `dist/`, no `/teams/`; JS/CSS/JSON byte-equal to `dist/`.
- Production verified: `tqccl.com` and `tqccl.pages.dev` serve `js/roster-recommend-ui.js`, `data/recommended/current.json`, `data/lookup-manifest.json` byte-equal to `dist/`; Vision `OPTIONS /analyze` from `https://tqccl.com` 204, foreign origin 403; `/api/me` 200.
- Previous production / rollback target: `ba81c78d-2c12-401f-8490-7febbca4e6ab` (`9291400`).

## Latest Community Worker Deploy

- Date: 2026-10-07
- Worker: `tqccl-community` (`https://tqccl-community.nguyennlt-ncc.workers.dev`), version `b89d7f9f-dfe1-4e51-a0d7-5815d15a4933`, source `9efe0da` (legacy `ai:providers` path removed in `714622c`); `tsc` clean, vitest 129/129. Rollback target: `f0431e38-a85b-4069-91b5-13546472554e` (2026-09-29).
- Live verification: `/api/me` returns 200 directly and through `https://tqccl.com/api/me`.
- KV `RL`: unused legacy key `ai:providers` deleted 2026-10-07 after both deploys; only `ai:config` remains under `ai:`. `/analyze` still reaches the Turnstile check (403) afterwards.

## Latest Research MCP Deploy

- Date: 2026-10-15
- Production URL: `https://mcp.tqccl.com`
- GitHub Actions run: `38720407246` (manual exact-SHA dispatch, `rehearse_rollback: false`); push gate on the same SHA: run `38717554122` green.
- Source commit: `a9f055effb4163825bfa4da156749dfd9983ea5a` (MCP skill redesign: seven tools, `fieldLabels`/`refNames`/`similarNames`, `build` in `tqccl_get_team`)
- Release ID: `sha256:30a102a1d9709bc89caf3c93d7ac60ed348aed8d85f274130a813f204ef7cfb2`
- Workflow build ID: `build:sha256b64:eWwYqy-IbV2Mlna4vlaYUfTtIiUftWAgfQbelTbghWs`
- Worker version ID: `1e1b1191-a7b4-4b37-a092-92b0ba069150` (tag = source commit)
- Deployments: smoke (prior 100% + candidate 0%) `cdfa1ff4-b75f-4564-a188-691862287df9`; production `10a33452-ae33-4c6a-8dbe-dc7c7eb41d8f`.
- Status: verified at 100% traffic by the workflow verifier (Version Override, then production without override). `wrangler deployments status` shows only `1e1b1191…` at 100%; `/healthz` 200, unauthenticated `/mcp` 401.
- Note: in the dispatch run the parallel `credential-free-release-gate` job failed on a timing-racy unit test (`roster-scan-state` compared two `new Date()` reads); the push gate for the same SHA had passed. Test fixed in the next commit.
- Rollback target: version `8264ea76-efc2-4cd5-b446-49a03a89184d` (deployment `44f7d0c4-1b4f-487d-acb1-00596400843b`, `2a754f5`, eight old tools). Dewee: no agent or user grant on server `tqccl`; `tra` still uses local `tqccl-local`.

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
