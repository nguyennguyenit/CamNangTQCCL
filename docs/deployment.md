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

- Date: 2026-10-16
- Production URL: `https://tqccl.com` (primary). `https://www.tqccl.com` returns `301` to the same path and query through a zone Redirect Rule; `https://tqccl.pages.dev` hands over through the head bridge script.
- Deployment: `ad12bf98-9990-4ff3-b3d0-baeb792643fb` (`https://ad12bf98.tqccl.pages.dev`)
- Source commit: `1194207` (`origin/main`): PR #9 (team and lookup content prerendered for AI crawlers, 1772 lookup item pages, JSON-LD, `/llms/*.txt` + `/llms-full.txt`, sitemap 4912 URLs, stale-state guard for list pages) and PR #8 (`/quan-tri/` redesign). Recommended generation `5d9358db…`.
- Method: `pages-deploy.yml` `workflow_dispatch` on `main` (run `38935939825`: `npm run build`, `npm run verify` 5156 files, `wrangler pages deploy dist --branch main --commit-hash 1194207…`). Before merge, the PR head passed the credential-free release gate; locally Playwright 491/491, `test:node` 593/593, `test:dist` 49/49, pytest OK, `npm run check` 0 errors.
- Production verified (`-A ClaudeBot`, no JS): `/llms.txt` and `/llms-full.txt` 200 `text/plain` (2.67 MB); `/tra-cuu/chien-phap/`, `/tra-cuu/tuong/sp-lu-mong/`, `/zh/tra-cuu/binh-thu/di-truc-bao-oan/`, `/doi-chuan/`, `/khai-hoang/`, `/quan-tri/` 200; a Đội chuẩn detail page carries heroes and tactics in HTML; `/sitemap.xml` 4912 `<loc>`; `/teams/` and `/_headers` 404; `js/app.js`, `js/khaihoang-detail.js` byte-equal to source; `www` 301 with path and query. Playwright on `https://tqccl.com`: `/doi-chuan/?season=pk-s24` ends on the PK-S24 list with no `data-ssr-stale` left, Khai hoang, lookup and `/quan-tri/` boot with no page errors.
- Not yet deployed: community Worker `GET /api/admin/counts` (PR #8) still returns 404 on `tqccl-community`; `/quan-tri/` keeps working and only hides the pending-work badges until the Worker is deployed.
- Previous production / rollback targets: `6a478f82-a2c9-46a6-8666-8f322ce15ef8` (`fabd7d4`), `ff01ace5-b799-4977-84ca-22580033c309` (`a9f055e`).

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
