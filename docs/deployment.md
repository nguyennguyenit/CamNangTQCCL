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

- Date: 2026-10-18
- Production URL: `https://tqccl.com` (primary). `https://www.tqccl.com` returns `301` to the same path and query through a zone Redirect Rule; `https://tqccl.pages.dev` hands over through the head bridge script.
- Deployment: `ed919185-19f4-4243-a0f0-adfbcc62f5b8` (`https://ed919185.tqccl.pages.dev`)
- Source commit: `51e430e` (`origin/main`): PR #18 (user administration: moderators, bans, account deletion, admin audit log; new Người dùng and Nhật ký sections in `/quan-tri/`).
- Method: `pages-deploy.yml` `workflow_dispatch` on `main` (run `39068669133`), run only after D1 migration `0006` and the community Worker deploy below (Pages and Worker must match: `/api/me` now returns `role`). Locally before merge: community-worker vitest 386/386, `test:node` 595/595, `test:dist` 49/49, `npm run verify` 5157 files, Playwright 513/513; PR gate green.
- Production verified: `/quan-tri/` and `/zh/quan-tri/` 200; `js/community-admin-users.js`, `js/community-admin.js`, `js/community-auth.js`, `js/community-api.js` byte-equal to source. Playwright on `https://tqccl.com`: `/quan-tri/` boots with no page errors; a forged `?error=ACCOUNT_BANNED&error_description=fake` shows only the fixed fallback sentence, cleans the URL and the notice closes; public comments still render.
- Not verified by the deploy (needs a real Google sign-in): root/moderator flows, ban/unban, deletion and audit rows through production.
- Previous production / rollback targets: `ad12bf98-9990-4ff3-b3d0-baeb792643fb` (`1194207`), `6a478f82-a2c9-46a6-8666-8f322ce15ef8` (`fabd7d4`). Roll back together with the Worker (see `docs/community-worker.md`).

## Latest Community Worker Deploy

- Date: 2026-10-18
- Worker: `tqccl-community` (`https://tqccl-community.nguyennlt-ncc.workers.dev`), version `a8092192-4fb3-4b46-9a3b-1496f5ca40cb`, source `3554bba` (PR #18 head, merged as `51e430e`); `tsc` clean, vitest 386/386. Also ships PR #8's `GET /api/admin/counts`. Rollback target: `b89d7f9f-dfe1-4e51-a0d7-5815d15a4933` (2026-10-07, `9efe0da`).
- D1 `tqccl-community`: migration `0006_user_admin.sql` applied 2026-10-18 (32 users kept, all `role = 'user'`; 7 new `user` columns, `admin_audit`, 6 indexes, 4 triggers). Time-travel bookmark before the migration: `00000473-00000000-00005107-2cb1e9c2d69074179a7caa097e865ed9`. Rehearsed first on a throwaway remote D1 loaded from a production export (deleted afterwards): session/upload inserts for a banned or deleting user fail with `account_blocked` (`SQLITE_CONSTRAINT_TRIGGER`), expired bans and clean users insert normally.
- Live verification through `https://tqccl.com`: `/api/me` 200 `{"user":null}`; `/api/admin/counts`, `/api/admin/users`, `/api/admin/audit` 401 `unauthorized`; `/api/ban-notice?token=x` 404; public `/api/comments` and `/api/reports/stats` return data.

## Latest Research MCP Deploy

- Date: 2026-10-15 (19:35 UTC)
- Production URL: `https://mcp.tqccl.com`
- GitHub Actions run: `38791836717` (manual exact-SHA dispatch, `rehearse_rollback: false`); push gate on the same SHA: run `38789084426` green.
- Source commit: `eb08691ec3cf34689e7c5b529bcfc98c6a8e653f`. Adds `innateHeroIds` to `tqccl_get_entity` for tactics (`fabd7d4`) and the release-driver fixes below (`f76d3af`, `6f7235e`, `7fe6198`, `eb08691`).
- Release ID: `sha256:6a54e59da2365913e58a759960c31bb21fed47a700f036c384fb4cac55b11256`
- Workflow build ID: `build:sha256b64:x7ucanKrRW220KswL0isAPFuvAmrv8DnO3xz_WkmbHQ`
- Worker version ID: `dbba08a2-b92b-42ea-89c2-2265eba08a9c` (tag = source commit)
- Deployments: prior `84303896-18f5-49a7-9c47-cd60a2262d86` (`1e1b1191` 100%), smoke `bdccf68c-5ee4-456a-ba80-d2133802ab44` (prior 100% + candidate 0%), production `a5815306-7be7-4b7f-acc3-11d263d1b886`.
- Status: verified at 100% traffic by the workflow verifier (Version Override, then production without override). `wrangler deployments status` shows only `dbba08a2…` at 100%; `/healthz` 200, unauthenticated `/mcp` 401.
- Evidence: settle before the override smoke took 24 probes with 4 responses from the other version; before production verification 23 probes with 3 from the other version. Both deployment POSTs (smoke, promote) returned responses the client rejects (`mutationErrors` reason `shape`); the controller reconciled each from the read-back.
- Failed attempts the same day, production left on `1e1b1191` each time: `38743557129` (rolled back after promote, edge still served the prior version), `38754775623` (smoke restored, same cause under Version Override), `38762022539` (smoke POST response rejected and the immediate read-back still showed the prior; a 0% candidate was left and removed by hand with `wrangler versions deploy 1e1b1191…@100%` at 17:58 UTC), `38784835089` (rolled back after promote with only a 5-probe settle).
- Rollback target: version `1e1b1191-a7b4-4b37-a092-92b0ba069150` (`a9f055e`, deployed 10:44 UTC as `10a33452-ae33-4c6a-8dbe-dc7c7eb41d8f`); older `8264ea76-efc2-4cd5-b446-49a03a89184d` (`2a754f5`, eight old tools).
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
