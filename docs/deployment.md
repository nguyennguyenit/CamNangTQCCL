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

- Date: 2026-10-21
- Production URL: `https://tqccl.com` (primary). `https://www.tqccl.com` returns `301` to the same path and query through a zone Redirect Rule; `https://tqccl.pages.dev` hands over through the head bridge script.
- Deployment: `https://cb91471a.tqccl.pages.dev`
- Source commit: `1fa81ab` (`origin/main`): PR #22 (Chinese effects with a declared source: `zhEffects` → `lookup.effectZhSource`, 63 entries = 31 source + 16 capture + 16 translation, 0 pending tactics; translation flag on the tactic profile vi + zh, zh related cards and the zh tactic table; zh meta/JSON-LD of translated entries without the effect snippet). Same SHA as Research MCP release below.
- Method: main frozen from the PR #22 merge to the MCP release. `pages-deploy.yml` `workflow_dispatch` on `main` (run `39630151392`, headSha `1fa81ab`, `main` unchanged until after MCP). Before merge (WSL, Node 24.20.0, on the generated outputs of transaction `chu-han-nguon-261020-r3`): `unittest` 458 OK, `test:node` 620/620, `test:dist` 50/50, `npm run verify`, `mcp-worker check` 544/544, Playwright 539 passed, `lookup_route_handles`/`team_route_handles`/`site_localization --stage public`/`report-zh-gaps`/`design-tokens` checks; PR gate green. Merged tree = tested head `ed833e2`.
- Production verified: redirect matrix `rules=36 expected=36 orphans=18 fail=0`; `/tra-cuu/chien-phap/tran-ap-khan-vang/` and `/zh/…` carry one `data-zh-source="translation"` flag, `ap-che` (source) and `tinh-bach-ma-nghia-tong` (capture) none; `/zh/tra-cuu/chien-phap/` row of `tran-ap-khan-vang` flagged, `/tra-cuu/chien-phap/` no flag; zh meta description `鎮壓黃巾（战法，品质A·指挥）。` (no effect snippet), vi meta keeps the Vietnamese effect.
- Previous production / rollback targets: `https://b60ddcd6.tqccl.pages.dev` (`5fe2933`, PR #24, run `39621620745`), `https://f9bffd66.tqccl.pages.dev` (`6b17d23`, PR #19). Rollback order: revert `main` first, then rerun `pages-deploy.yml`; roll back the Research MCP to `5dc07761…` together (it projects `effectZhSource`).

## Latest Community Worker Deploy

- Date: 2026-10-21
- Worker: `tqccl-community`, version `5ba5760f-c671-4a4b-9866-763cdb53ec16`, source `feat/doi-cong-dong` merged with `af3bc41` (PR #24, merged as `5fe2933`); `tsc` clean, vitest 537/537. Rollback target: `a8092192-4fb3-4b46-9a3b-1496f5ca40cb` (2026-10-18, PR #18). While the old Worker runs on a DB with community teams, do **not** delete accounts (see `community-worker.md` rollback).
- D1 `tqccl-community`: migration `0008_community_teams.sql` applied 2026-10-21 (20 statements: 4 tables, 8 indexes, 7 triggers). Time-travel bookmark before the migration: `00000544-00000000-0000510b-48686421508329cd216f59e064e90721`. Production D1 refuses `sqlite_version()`; `log(100)` returns `2` (base 10), so `hot_rank` works. Rehearsed on local workerd D1 + R2 with seeded sessions: open season → post team with image → moderator approve → votes → approved win report (`evidenceCount` 1, `points` 2) → new season (vote 409 `season_closed`, comment 201) → owner delete 409 `has_evidence` → moderator delete leaves no rows.
- Live verification through `https://tqccl.com`: `/api/community-seasons` 200 `{"open":null,"seasons":[]}`; `/api/community-teams?season=all` 200 empty; `/api/me/community-teams` 401 `unauthorized`.
- Previous: 2026-10-18 version `a8092192-4fb3-4b46-9a3b-1496f5ca40cb` (PR #18, migration `0006_user_admin.sql`, bookmark `00000473-00000000-00005107-2cb1e9c2d69074179a7caa097e865ed9`).

## Latest Research MCP Deploy

- Date: 2026-10-21 (16:00 UTC)
- Production URL: `https://mcp.tqccl.com`
- GitHub Actions run: `39630530573` (manual exact-SHA dispatch, `rehearse_rollback: false`). Job `production-release` green on attempt 1; the parallel job `credential-free-release-gate` (no deploy steps) failed on attempt 1 with `Timed out waiting 30000ms from config.webServer` (Playwright preview start) and passed on rerun (attempt 2).
- Source commit: `1fa81ab23758b022f7cc0209b56af24a27b2493d` (= Pages deployment above). `tqccl_get_entity` projects `profile.lookup.effectZhSource` (`null` | `{kind}`).
- Release ID: `sha256:98117d62c5595d2fabd6ddc601aa1bb237bbb3bacc7c52b1787660d3aa4d73ad`
- Workflow build ID: `build:sha256b64:Ch64kQimPnoGdnZ4UajzsY22LNGC3BdBeU3dJz5Iyi8`
- Worker version ID: `62cba122-22ac-434c-a017-05007cdc56e1`
- Deployments: prior `633e1dd6-8c64-4cf2-b68f-6a3b7725c686` (`5dc07761` 100%), smoke `a192f24e-e91d-4be9-8a85-36442b8d21dc` (prior 100% + candidate 0%), production `085f9618-8224-4b70-b1f4-a91a016449d7`.
- Status: `verified` by the workflow verifier. The local `mcp-worker` CLI on the released tree computes the same release ID and returns `tactic:tran-ap-khan-vang` `effectZhSource {kind: "translation"}`, `tactic:ap-che` `{kind: "source"}`, `tactic:tinh-bach-ma-nghia-tong` `{kind: "capture"}`, `tactic:lua-chay-ngun-ngut` → `tactic:han-thien-si-dia`, with no `ref`/`note`/`viSha256`. An authenticated live `tqccl_get_entity` call was not made from this machine (no managed bearer).
- Previous release (same day, 10:04 UTC, prerequisite "MCP #1"): run `39549913616` attempt 2 (attempt 1 stopped before deploy on a Playwright `page.goto` timeout), source `af3bc41` (PR #11 + PR #19), release `sha256:9bc5f63e72873a2be5ddbffc2a06f5a8dc900b87d9f78246dcf7d3651eed22a0`, workflow build `build:sha256b64:eAH85OT1z_TZ-scE_jimbjtEy5pfc-hRuE85XH6I980`, Worker version `5dc07761-6006-4adf-aa9a-ac749125530f`, deployments smoke `0666d99b-c49f-4166-a532-df8639033892`, production `633e1dd6-8c64-4cf2-b68f-6a3b7725c686`; settle 20/20 probes on the candidate. Local CLI on `af3bc41`: same release ID, `tactic:lua-chay-ngun-ngut` → `tactic:han-thien-si-dia`.
- Rollback target: version `5dc07761-6006-4adf-aa9a-ac749125530f` (`af3bc41`); older `dbba08a2-b92b-42ea-89c2-2265eba08a9c` (`eb08691`, 2026-10-15).
- Dewee consumer (self-hosted, build `ce452b49`), switched 2026-10-16: agent `tra` holds the grant on server `tqccl` (`https://mcp.tqccl.com/mcp`, 7 tools) with `tqccl_get_playbook` approved as safe context. Local server `tqccl-local` has no grant and is disabled; its config stays for rollback (`dewee mcp update tqccl-local --enabled=true`, `dewee mcp grant agent tqccl-local tra`, `dewee mcp revoke agent tqccl tra`). Smoke the same day: "Chiến pháp tự có của SP Tào Tháo" answered Thừa Thiên Tĩnh Thế through `mcp_tqccl__tqccl_get_playbook`, `tqccl_search` and `tqccl_get_entity`, citing data `6a54e59da236`.

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
