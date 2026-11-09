---
name: verify-tqccl
description: Drive the Cẩm Nang TQCCL handbook website (the Astro static UI a player uses at tqccl.com) locally with Playwright and prove user-facing behavior. Reach for this after changing pages, team lists, Tra cứu, chiêu mộ, or gợi ý đội — before reporting done. Do not use it to deploy, hit production, or change wrangler config.
---

# Verify Cẩm Nang TQCCL

This skill is for the next agent, mid-task, who has never seen the app. Drive the **real static site** the way a player does. Do not call production. Do not deploy. Do not edit `community-worker/wrangler.jsonc`, `worker/wrangler.toml`, bindings, secrets, or deploy workflows.

## Surfaces (interview)

| Surface | What a user touches | This skill |
|---|---|---|
| **Primary: handbook website** | Astro static UI: Landing, Đội chuẩn/Đội khác/Cùng Tồn/Khai hoang, Tra cứu, chiêu mộ, soi đội, gợi ý đội, cộng đồng pages | Launch + drive |
| Admin `/quan-tri/` | Staff console after Google login | Notes only — needs community-worker + OAuth |
| `community-worker/` `/api/*` | Session, comments, roster, teams, `/api/me` | Notes only — Pages Function proxy; `astro preview` does not serve it |
| `worker/` vision proxy | Soi đội / đọc ảnh | Notes only — would hit the production Worker URL in `js/config.js`; this harness **aborts every non-localhost request** |
| `mcp-worker/` | Research MCP CLI/HTTP | Out of scope |

Two verification instances can run side by side: different `--port` / `TQCCL_VERIFY_RUN_ID` / Playwright profiles. The site has no writable data dir (JSON is baked into `dist/`). Do **not** drive an instance this run did not launch.

## Launch

From the repo root, Node `>=24.20.0 <25` (`.node-version`). `/exec-daemon/node` on this VM is Node 22; `control-tqccl` re-execs `~/.nvm/versions/node/v24.20.0/bin/node` when present.

```bash
export PATH="$PWD/.cursor/skills/verify-tqccl/bin:$PATH"
export TQCCL_VERIFY_RUN_ID="${TQCCL_VERIFY_RUN_ID:-$(date +%s)}"
# optional parallel instance: export TQCCL_VERIFY_PORT=4176
control-tqccl launch
```

What launch does, in order:

1. `npm ci` if `node_modules/astro` is missing.
2. `npx playwright install chromium` (Chromium only).
3. `npm run build` unless `--reuse-dist` and `dist/index.html` already exist. Build may skip blog/community-team pages when `COMMUNITY_API_ORIGIN` is unset — that is expected and **must not** be pointed at production to fill them.
4. Starts `astro preview --ignore-lock --host 127.0.0.1 --port $PORT` (default **4175**, not e2e's 4174 and not `astro dev`'s 4321) as a new process group. Records that PID in `/tmp/tqccl-verify/runs/$RUN_ID/run.json`.
5. Waits until the instance is **usable**, not merely listening:
   - `GET http://127.0.0.1:$PORT/` is 200, contains `Cẩm Nang`, `Tam Quốc Chí`, and the landing heading `Mùa này chơi đội nào?`
   - `GET /doi-chuan/` is 200 and contains `id="section-team-chuan"`, the heading `Đội chuẩn`, and at least one `reference-team-card` (the `Tìm Đội chuẩn` searchbox is inserted after `data-boot=ready`, so it is not a launch check)

Ready log line equivalent: stdout `launched <id>` + `url http://127.0.0.1:4175`. Teardown: `control-tqccl cleanup` (kills that PID's process group only).

`npm run dev` (`astro dev` on 4321) is the documented human loop. Verification uses **preview of `dist/`**, matching `playwright.config.mjs`, because that is the published artifact. Landing `/` does not load `js/app.js` (no `data-boot`). Section pages that do load app.js are usable for driving only after `body[data-boot="ready"]`.

Do not start `wrangler dev` / `wrangler pages dev` for the mapped features. Those processes need secrets in `community-worker/.dev.vars` and are the admin/API surface.

## Doctor

```bash
control-tqccl doctor
control-tqccl doctor --json
```

Read-only. Pass only if all of these hold:

- The launch PID is still alive.
- TCP `$PORT` is listening **and owned by that PID or its descendants** (`ss -ltnp`). Never attach to someone else's preview.
- `HEAD`/live `git rev-parse HEAD` matches the revision recorded at launch (mismatch → this `dist/` is stale; relaunch without `--reuse-dist`).
- Node recorded at launch satisfies `.node-version`.
- `GET /` and `GET /doi-chuan/` still show the identity checks above.

If anything looks off, run doctor before driving. After a failed drive, run doctor again. Never drive a shared instance.

## Drive

Harness: Playwright Chromium through `control-tqccl browser` (alias: `control-tqccl drive`). Each command opens the run's persistent profile at `$RUN_DIR/browser-profile`, restores `lastUrl`, then exits. localStorage persists in that profile. The current page URL is stored in `run.json`.

The browser **aborts every request whose host is not `127.0.0.1`/`localhost`**. That is how this skill obeys "never call production" (`js/config.js` otherwise points at `tqccl-vision-proxy…workers.dev` and Turnstile).

Prefer the same handles the e2e specs use: ARIA role + accessible name, `data-boot`, route paths. Desktop recipes use `.quick-nav` links (the floating column on inner pages). The header dropdown labels (`Đội hình`, `Tra cứu`, `Công cụ`) are menus, not the section links.

```bash
control-tqccl browser goto --path /doi-chuan/
control-tqccl browser wait --boot
control-tqccl browser fill --role searchbox --name "Tìm Đội chuẩn" --value "Lưu Bị"
control-tqccl browser click --role link --name "Chi tiết" --nth 0
control-tqccl browser text --role heading --level 1
control-tqccl browser screenshot --path doi-chuan/detail.png --feature doi-chuan --entry detail
control-tqccl browser snapshot --aria --path doi-chuan/detail.aria.yml --feature doi-chuan --entry detail
control-tqccl browser url
```

Other verbs: `press --key Escape`, `eval --js "…"`, `wait --role heading --name "Tướng"`, `click --role link --name "Đội chuẩn"` (from `.quick-nav` on a section page, or landing CTA `Mở Đội chuẩn`). `--loose` turns off exact name matching. Paths must start with `/`; absolute `https://tqccl.com/…` is rejected.

Read `features/README.md` then the matching feature file. Drive every listed entry point, or report the skipped one as unverified.

## Evidence

Location (survives cleanup): `/tmp/tqccl-verify/evidence/$RUN_ID/` (override with `TQCCL_VERIFY_EVIDENCE`). `cleanup` deletes only `/tmp/tqccl-verify/runs/$RUN_ID/`.

Proof standards:

- Exercise the real player path (click, type, follow a link). Do not poke `localStorage` via `eval` as a substitute for the control, and do not call `/api/*` test doubles as proof of the UI.
- Capture the **action and the resulting state** (screenshot + ARIA snapshot of the page after the click, plus `url`).
- Mutation proof: a second user-facing read (reload, Back, or a second view). For chiêu mộ / gợi ý đội, reload and read the meter/list; `eval` of `localStorage` is supporting evidence, not the proof.
- Record `--feature` and `--entry` on every screenshot/snapshot (appended to `INDEX.jsonl`).
- UI proof must show the Cẩm Nang lockup (`alt="Cẩm Nang"` plus `Game Tam Quốc Chí – Chiến Lược`) or the page `h1`.
- Mocks: the harness's localhost-only network policy is the production-boundary isolation. Do not add further stubs to make a journey pass. If a journey needs Google login or `/api/*`, it is unreachable in this launch — report the unmet precondition, do not weaken the journey.

## Cleanup

```bash
control-tqccl cleanup
```

Sends SIGTERM (then SIGKILL) to the **process group of the PID in `run.json`**. Never `pkill astro` / `pkill node`. Removes the run directory (preview log, browser profile, pid). Does **not** remove `/tmp/tqccl-verify/evidence/$RUN_ID/`. After cleanup, confirm that directory still exists and still contains the screenshots/ARIA files.

If a launch/drive iteration fails, run cleanup before the next launch so ports and Chromium profiles are not stranded. `--force` on launch cleans the current run first.

## Helpers

`control-tqccl` is executable. Invocation is shown in Launch / Doctor / Drive / Cleanup. Source: `.cursor/skills/verify-tqccl/bin/control-tqccl` → `control-tqccl.mjs`.

```bash
control-tqccl help
```

## Maintenance

When routes, labels, or launch steps drift, run `/maintain-verification-skill` (pstack) rather than editing the map from memory.
