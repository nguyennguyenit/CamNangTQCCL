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
- Deployment URL: `https://6a478f82.tqccl.pages.dev`
- Source commit: `fabd7d4` (`origin/main`). Tactic dialog "Cách nhận" lists innate holders through the shared rule in `js/lookup-innate-holders.js` (heroes matched only by the Chinese innate-tactic name now show, e.g. Tiểu Kiều → Thiên Hương). Recommended generation `989c9919…`. Builds on `a9f055e` (deployment `ff01ace5`, same day: MCP skill redesign, "Dùng món này" button enabled again).
- Method: local `wrangler pages deploy dist --branch main --commit-hash fabd7d4…` from a clean worktree, same `dist/` first deployed as preview `https://f648ffe0.tqccl.pages.dev` (branch `release-fabd7d4`). Build used `COMMUNITY_API_ORIGIN` like `pages-deploy.yml`. Local gate: localization `check --stage public`, `team_route_handles --check`, `build`, `verify` (3344 files), `test:dist` 32/32, `test:node` 541/541, pytest 393 passed, MCP `check:repository` green; MCP `check` 530 with four load-timeout files green when rerun sequentially (36/36).
- Preview verified: shell, `/tra-cuu/chien-phap/`, Đội chuẩn and Khai hoang detail 200; `/teams/…` and `/_headers` 404; `/robots.txt` byte-equal to source; `/sitemap.xml` `application/xml` with the `dist/` URL count; changed JS and JSON byte-equal to `dist/`; Playwright on the preview: Thừa Thiên Tĩnh Thế shows SP Tào Tháo, Thiên Hương shows Tiểu Kiều, no page errors.
- Production verified: the same Playwright check on `https://tqccl.com`; `js/lookup-innate-holders.js`, `js/lookup-tactic-profile.js`, `data/recommended/current.json` byte-equal to `dist/` (one read right after promotion returned the previous `lookup-tactic-profile.js`; three later uncached reads matched); `www` 301 with path and query; `/api/me` 200.
- Previous production / rollback targets: `ff01ace5-b799-4977-84ca-22580033c309` (`a9f055e`), `ba81c78d-2c12-401f-8490-7febbca4e6ab` (`9291400`).

## Latest Community Worker Deploy

- Date: 2026-10-07
- Worker: `tqccl-community` (`https://tqccl-community.nguyennlt-ncc.workers.dev`), version `b89d7f9f-dfe1-4e51-a0d7-5815d15a4933`, source `9efe0da` (legacy `ai:providers` path removed in `714622c`); `tsc` clean, vitest 129/129. Rollback target: `f0431e38-a85b-4069-91b5-13546472554e` (2026-09-29).
- Live verification: `/api/me` returns 200 directly and through `https://tqccl.com/api/me`.
- KV `RL`: unused legacy key `ai:providers` deleted 2026-10-07 after both deploys; only `ai:config` remains under `ai:`. `/analyze` still reaches the Turnstile check (403) afterwards.

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
- Rollback target: version `1e1b1191-a7b4-4b37-a092-92b0ba069150` (`a9f055e`, deployed 10:44 UTC as `10a33452-ae33-4c6a-8dbe-dc7c7eb41d8f`); older `8264ea76-efc2-4cd5-b446-49a03a89184d` (`2a754f5`, eight old tools). Dewee: no agent or user grant on server `tqccl`; `tra` still uses local `tqccl-local`.

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
