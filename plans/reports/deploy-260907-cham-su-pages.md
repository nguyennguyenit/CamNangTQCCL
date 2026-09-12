# Chạm Sứ Pages release — 2026-09-07

Status: production deployed and verified. Static site only; neither Worker redeployed. No Git push performed; four local commits remain ahead of the last fetched origin/main.

## Release

- Source: `0a5780155d7aa3fcb1869b4f5bb11912ead3db2f`, clean detached checkout of local main.
- Node 22.16.0, Wrangler 4.71.0. Clean npm install, Astro check (zero diagnostics), build, nine artifact tests and verifier (36 files) passed. Full implementation gates previously passed: Python89, Node138, E2E21; see [validation](../260907-0236-cham-su-khai-hoang/reports/validation.md).
- Preview: https://505fb655.tqccl.pages.dev; branch cham-su-0a57801.
- Production: `4e35bd85-0759-4e39-ae20-e785300c9757`, https://4e35bd85.tqccl.pages.dev, canonical https://tqccl.pages.dev.
- Previous production/rollback: `cc23dd7a-c1ad-4bc0-b920-634fa7436e23`.
- Production reused all 35 preview assets; no rebuild between uploads.
- Artifact SHA256: `4080a9d289bedde373ba5e9d3593fc685efb884c11a314a0376c61e58187e1cc`.
- Scoped-source SHA256: `a6f0c2aacda32b9e63fd6f2fa93f297f3194f05c95e74048690bfd17bf802b0d`.
- Digests: sorted relative path, NUL, bytes, NUL; source scope package/config files and src/js/css/data/public.

## Live verification

- Preview and canonical production: 35 public files exactly match uploaded artifact; cache headers contain max-age=0 and must-revalidate. Root shell also exact. index.html redirect followed to canonical root.
- Six private/control path probes yielded 404 or exact public shell fallback, never private bytes.
- Chromium preview and production: 8 Chạm Sứ cards, 15 opening cards, correct section order, no transforms; nine sections navigated, reload passed, no page errors or mobile horizontal overflow at 375px.
- Vision OPTIONS204, malformed-JSON POST400, alien-origin POST403; no model request or paid scan.
- Initial Python HTTP probe received403; curl and Chromium probes succeeded. A subsequent check correctly followed Pages index.html308 redirect. No server/security settings altered.
- Git worktree cleanup follows successful verification; browser processes closed in finally blocks. Existing workspace WIP preserved.

## Evidence

[Preview HTTP](deploy-260907-cham-su-preview.json), [production HTTP](deploy-260907-cham-su-production.json), [preview browser](deploy-260907-cham-su-preview-browser.json), [production browser](deploy-260907-cham-su-production-browser.json), [canaries](deploy-260907-cham-su-canaries.json).

Workflow reference: [Cloudflare Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/).

Open questions: none for deployment. Git push remains a separate pending confirmation about two preexisting archive commits.
