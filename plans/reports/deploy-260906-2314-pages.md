# Static Pages release — 2026-09-06

Status: production deployed and verified. Scope: static website; Research MCP and Vision Workers were not redeployed.

## Artifact and deployment

- Source: clean local `main`, `b501d37d1be3812f2c126df4398b13cca4fb6f58`.
- Build runtime: Node 22.16.0. Deployment CLI: Wrangler 4.71.0.
- Preview: `f02756ca-1df0-487c-99ce-0a9a72823e60`, https://f02756ca.tqccl.pages.dev.
- Production: `cc23dd7a-c1ad-4bc0-b920-634fa7436e23`, https://cc23dd7a.tqccl.pages.dev.
- Canonical URL verified: https://tqccl.pages.dev.
- Rollback target recorded before upload: `239d7027-a7d4-42cf-aa02-358e9b4abfcb`.
- Both uploads used the same local `dist/`; production reused all 35 uploaded public assets. `_headers` is deployment control, not a public file.
- No Git push was needed for direct upload. The two local archive commits remained unpushed at deployment.

SHA-256 digests use sorted relative paths, then each path, NUL, file bytes, NUL:

| Scope | Files | Digest |
| --- | ---: | --- |
| `.node-version`, package manifests, Astro/TypeScript config, and all files under `src/`, `js/`, `css/`, `data/`, `public/` | 47 | `14cf549faaa539d78f4fb51000c6de0e50c020e5588a9e1cf7dd67aa0c9cb1cb` |
| Complete `dist/` | 36 | `536fd981dbc2a27252598ef1e2978c0f29c04761a22c771b5e0c9f0df2fdc830` |

## Verification

- `npm run check`: zero errors, warnings, or hints.
- `npm run build`, `npm run test:dist` (9 tests), `npm run verify`: passed; 36 allowlisted output files.
- `npm run test:node`: 137 passed.
- `python3 -m unittest discover -s tests`: 84 passed.
- Worker `npm test`: 53 passed; `npm run typecheck`: passed using existing installed dependencies.
- `npm run test:e2e`: 16 passed, including local HTTP and routed HTTPS probes. The owned preview process stopped after the suite.
- Preview and canonical production: all 35 public files byte-identical to `dist/`, with `max-age=0, must-revalidate`; root HTML matched the built shell.
- Six private/control URL probes returned either 404 or the public index fallback, never private source contents.
- Live Chromium on preview and production: all 9 sections navigated; 15 opening teams; 3 Beta badges; every existing team-level note matched local data; reload passed; no page errors or failed first-party responses.
- Vision canaries: canonical-origin OPTIONS 204; malformed JSON POST 400; alien-origin POST 403. CORS allowed origin remained `https://tqccl.pages.dev`. Preview-origin POST was blocked with 403. No model request or quota-consuming scan was made.
- Additional HTTP probes to `https://tqccl.com` and `https://www.tqccl.com` returned Cloudflare 403. Those custom domains were not verified as usable; the successful release checks target the documented canonical Pages URL.

Machine-readable live checks: [preview](deploy-260906-2314-pages-preview.json), [production](deploy-260906-2314-pages-production.json).
