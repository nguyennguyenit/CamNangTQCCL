# Deployment

## Platform: Cloudflare

Project deploy is split into three surfaces:

- Static site: Cloudflare Pages project at `https://tqccl.pages.dev`.
- Research MCP Worker: `https://mcp.tqccl.com`.
- Vision proxy Worker: `https://tqccl-vision-proxy.nguyennlt-ncc.workers.dev`.

## Latest Worker Deploy

- Date: 2026-07-11
- Worker: `tqccl-vision-proxy`
- Version ID: `47bff736-95ab-4a51-88c7-514c0cb7b88b`
- Source commit deployed from local main: `7bf5797`

## Latest Static Pages Deploy

- Date: 2026-08-25
- Production URL: `https://tqccl.pages.dev`
- Deployment URL: `https://239d7027.tqccl.pages.dev`
- Deployment ID: `239d7027-a7d4-42cf-aa02-358e9b4abfcb`
- Source commit: `2a754f5a4508695dd7871bf72fd348117f9aeba3`
- Published files: `index.html`, `css/`, `js/`, `data/`

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

Static site is expected to deploy from `main` through Cloudflare Pages.

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

- `ALLOWED_ORIGIN`
- `REGION`
- `MODEL_ID`
- `FEATURE_ENABLED`
- `RL_PER_HOUR`
- `DAILY_CAP`
- `MONTHLY_CAP`
- `MAX_IMAGE_BYTES`

Worker secrets are managed in Cloudflare and must not be committed:

- `QWEN_API_KEY`
- `TURNSTILE_SECRET`

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
