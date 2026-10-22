# Deployment

## Platform: Cloudflare

Project deploy is split into three surfaces:

- Static site: Cloudflare Pages project at `https://tqccl.pages.dev`.
- Research MCP Worker: `https://mcp.tqccl.com`.
- Vision proxy Worker: `https://tqccl-vision-proxy.nguyennlt-ncc.workers.dev`.

## Batch rollback markers (plan 261022-1109, 9 issues)

- Before the first merge of the batch (2026-10-22): `main` = `5b6014a` (docs-only on top of `957bb3d`); production Pages deployment `https://ec3c9558.tqccl.pages.dev` (`957bb3d`, run `39651871017`); Research MCP Worker version `93d02cc5-3b56-4e93-90aa-3fc6bc9f927b`; community Worker version `5ba5760f-c671-4a4b-9866-763cdb53ec16`.
- Serial-lane merges (phases 5, 7, 8, 9, 10) record their merged SHA here and in the plan's progress table. Roll back by reverting those merges in reverse order down to a recorded SHA; never revert one PR from the middle of the lane.
- Merged so far (none deployed to production yet; GitHub Actions minutes ran out mid-batch, so each PR was gated by the same `check:repository` job run locally on its exact head):
  - Free lane: `18099d1` (PR #28, roster worker routes + D1 `0011` migration file, not applied remotely), `c82f8fa` (PR #27, #16), `a7e217b` (PR #32, community-worker export + `site-publish`; `pages-deploy.yml` accepts both dispatch types), `7c812a6` (PR #29, #12), `c95bdf1` (PR #30, #15).
  - Serial lane: `edd9f08` (PR #31, #14), `444c791` (PR #33, #5), `6ef0395` (PR #34, #20), `5538533` (PR #35, #6). Phase 10 (PR #36) is not merged: it waits for the release window after the community Worker + D1 `0011` release.

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
- Deployment: `https://ec3c9558.tqccl.pages.dev`
- Source commit: `957bb3d` (`origin/main`): PR #25 (follow-up of PR #22: `tactic:dam-tam`, `tactic:tinh-hoa`, `tactic:truy-thuong` Chinese effects gain their level activation ranges; lookup generation `lookup:9da6c224…`). Same SHA as the Research MCP release below.
- Method: `pages-deploy.yml` `workflow_dispatch` on `main` (run `39651871017`, headSha `957bb3d`, `main` unchanged until after MCP). PR gate green (full Playwright in CI). Local (WSL): `unittest` 459 OK, `test:node` 620/620, `test:dist` 50/50, route/l10n/zh-gaps/design-tokens checks; `mcp-worker check` 544/544 on rerun (first run `domain-budget` 2001 ms > 2000); local Playwright 538 passed + 2 timing failures outside Tra cứu, reruns stopped at the 30 s `webServer` limit while the host was loaded.
- Production verified: `/zh/tra-cuu/chien-phap/dam-tam/`, `tinh-hoa`, `truy-thuong` show `發動率23%→45%`, `30%→45%`, `25%→40%`; `/tra-cuu/chien-phap/lua-chay-ngun-ngut/` still `301` → `/tra-cuu/chien-phap/han-thien-si-dia/`.
- Previous production / rollback targets: `https://cb91471a.tqccl.pages.dev` (`1fa81ab`, PR #22, run `39630151392`; full redirect matrix and flag checks recorded at that deploy), `https://b60ddcd6.tqccl.pages.dev` (`5fe2933`, PR #24). Rollback order: revert `main` first, then rerun `pages-deploy.yml`; roll back the Research MCP together.

## Latest Community Worker Deploy

- Date: 2026-10-22 17:45 UTC (2026-10-23 00:45 UTC+7)
- Worker: `tqccl-community`, version `771191b8-8ca8-4c19-bb05-4e4f91465e7b`, source `main` `99de31c` (includes PR #28 roster routes, PR #32 public team export + `site-publish` dispatch, PR #38 roster batch cap 12 for the Workers Free plan). Gate on that tree: vitest 595/595, `tsc` clean, `wrangler deploy --dry-run` ok.
- Rollback target: `c04a352c-9bf7-45c1-8b42-fd60eabb1a6b` (deployed 2026-10-22 13:42 UTC outside this record: it already served `/api/roster` (401) but D1 `0011` was not applied yet and `/api/community-teams/export` was 404). Older: `5ba5760f-c671-4a4b-9866-763cdb53ec16` (PR #24). While an older Worker runs on this DB, do **not** delete accounts (see `community-worker.md` rollback).
- D1 `tqccl-community`: migration `0011_roster.sql` applied 2026-10-22 ~17:45 UTC, just before the deploy (5 commands: table `roster_records` + 3 indexes, confirmed via `sqlite_master`). Time-travel bookmark before the migration: `0000058d-00000000-0000510c-dfbfecc410f7c85bf0f0f97854dabd44`. Account is on Workers Free: 50 D1 queries per invocation, hence `ROSTER_MAX_BATCH = 12`.
- Live verification through `https://tqccl.com`: `/api/roster` 401 `unauthorized`; `/api/community-teams/export` 200 `{"schemaVersion":1,"items":[]}`; `/api/community-seasons` 200; `/api/community-teams?season=all` 200 empty; `/api/me/community-teams` 401. Not yet run: the signed-in `/api/roster` round trip (save → read → tombstone a test box with a real Google account) — the browser relay was unavailable; do it in the release-window checklist.
- Pages workflow: the Worker now dispatches `site-publish` (blog publish/unpublish/edit, community team approve/delete, user ban/unban/delete); `pages-deploy.yml` on `main` accepts both `blog-publish` and `site-publish`. GitHub Actions minutes are exhausted, so no Pages run will start until they return.
- Previous: 2026-10-21 version `5ba5760f-c671-4a4b-9866-763cdb53ec16` (PR #24, migration `0008_community_teams.sql`, bookmark `00000544-00000000-0000510b-48686421508329cd216f59e064e90721`); 2026-10-18 `a8092192-4fb3-4b46-9a3b-1496f5ca40cb` (PR #18, migration `0006_user_admin.sql`, bookmark `00000473-00000000-00005107-2cb1e9c2d69074179a7caa097e865ed9`).

## Latest Research MCP Deploy

- Date: 2026-10-21 (18:55 UTC)
- Production URL: `https://mcp.tqccl.com`
- GitHub Actions run: `39652210255` (manual exact-SHA dispatch, `rehearse_rollback: false`); both jobs green.
- Source commit: `957bb3d92b0aef996720cbdf702657207a01a462` (= Pages deployment above).
- Release ID: `sha256:0865667b80b49cf132fcf4086526459f0ae64223b81c9bdec8c7aa417fd7138e`
- Workflow build ID: `build:sha256b64:Ch64kQimPnoGdnZ4UajzsY22LNGC3BdBeU3dJz5Iyi8` (code unchanged since `1fa81ab`)
- Worker version ID: `93d02cc5-3b56-4e93-90aa-3fc6bc9f927b`
- Deployments: prior `085f9618…` (`62cba122` 100%), smoke `4ba0b14c-f715-4b85-b390-4236cd6ba7d6`, production `16434098-6f0c-4d99-83e7-ee90446cabc0`. Status `verified` by the workflow verifier.
- Previous release (16:00 UTC): run `39630530573`, source `1fa81ab` (PR #22), release `sha256:98117d62c5595d2fabd6ddc601aa1bb237bbb3bacc7c52b1787660d3aa4d73ad`, Worker version `62cba122-22ac-434c-a017-05007cdc56e1`, deployments smoke `a192f24e-e91d-4be9-8a85-36442b8d21dc`, production `085f9618-8224-4b70-b1f4-a91a016449d7`; job `credential-free-release-gate` passed on rerun after a `webServer` timeout. The local `mcp-worker` CLI on that tree computed the same release ID and returned `tactic:tran-ap-khan-vang` `effectZhSource {kind: "translation"}`, `tactic:ap-che` `{kind: "source"}`, `tactic:tinh-bach-ma-nghia-tong` `{kind: "capture"}`, `tactic:lua-chay-ngun-ngut` → `tactic:han-thien-si-dia`, no `ref`/`note`/`viSha256`. No authenticated live `tqccl_get_entity` call was made from this machine (no managed bearer).
- Previous release (same day, 10:04 UTC, prerequisite "MCP #1"): run `39549913616` attempt 2 (attempt 1 stopped before deploy on a Playwright `page.goto` timeout), source `af3bc41` (PR #11 + PR #19), release `sha256:9bc5f63e72873a2be5ddbffc2a06f5a8dc900b87d9f78246dcf7d3651eed22a0`, workflow build `build:sha256b64:eAH85OT1z_TZ-scE_jimbjtEy5pfc-hRuE85XH6I980`, Worker version `5dc07761-6006-4adf-aa9a-ac749125530f`, deployments smoke `0666d99b-c49f-4166-a532-df8639033892`, production `633e1dd6-8c64-4cf2-b68f-6a3b7725c686`; settle 20/20 probes on the candidate. Local CLI on `af3bc41`: same release ID, `tactic:lua-chay-ngun-ngut` → `tactic:han-thien-si-dia`.
- Rollback target: version `62cba122-22ac-434c-a017-05007cdc56e1` (`1fa81ab`); older `5dc07761-6006-4adf-aa9a-ac749125530f` (`af3bc41`), `dbba08a2-b92b-42ea-89c2-2265eba08a9c` (`eb08691`, 2026-10-15).
- Dewee consumer (self-hosted, build `ce452b49`), switched 2026-10-16: agent `tra` holds the grant on server `tqccl` (`https://mcp.tqccl.com/mcp`, 7 tools) with `tqccl_get_playbook` approved as safe context. Local server `tqccl-local` has no grant and is disabled; its config stays for rollback (`dewee mcp update tqccl-local --enabled=true`, `dewee mcp grant agent tqccl-local tra`, `dewee mcp revoke agent tqccl tra`). Smoke the same day: "Chiến pháp tự có của SP Tào Tháo" answered Thừa Thiên Tĩnh Thế through `mcp_tqccl__tqccl_get_playbook`, `tqccl_search` and `tqccl_get_entity`, citing data `6a54e59da236`.

## Deploy Commands

Static site uses Cloudflare Pages direct upload from a verified, clean `main` checkout.
Follow the preview and production checks in [the deployment guide](deployment-guide.md).
After verification, upload `dist/` with `wrangler pages deploy dist --project-name tqccl --branch main --commit-hash <verified-sha>`.

Research MCP production deploys only through the manual exact-SHA workflow in
`.github/workflows/mcp-worker.yml`. The credential-free release gate runs on
pull requests and weekly on `main` (not on every push; direct pushes are gated by
the local `.githooks/pre-push` hook) and never deploys production.

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
