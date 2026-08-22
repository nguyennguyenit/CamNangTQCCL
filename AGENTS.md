# AGENTS.md

## Cursor Cloud specific instructions

Durable, non-obvious notes for future cloud agents. The startup update script already
refreshes dependencies (root, `worker/`, `mcp-worker/` npm installs plus the Playwright
Chromium browser), so this section focuses on gotchas rather than one-off install steps.
Standard commands live in `README.md` (root scripts) and each `package.json`.

### Toolchain / Node version

- The repo pins Node `22.16.0` (see `.node-version`); `mcp-worker` also declares
  `engines.node >=22.16.0 <23`. There is no `engine-strict`, so npm only warns on a
  mismatch.
- The bare `/exec-daemon/node` on the base image is Node `22.14.0` and ships **no `npm`**.
  The real toolchain comes from `nvm`, which is sourced by `~/.bashrc`. A login shell
  (the default for the shell tool) already selects Node `22.16.0` for both `node` and
  `npm` via the nvm default alias. If a non-login/non-interactive shell resolves the wrong
  `node` (or cannot find `npm`), run:
  `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22.16.0`.

### Services / how to run

This is a static Astro site plus two independently-deployed Cloudflare Workers; there is
no shared backend to boot for local development.

- Site (root): `npm run dev` serves the app (bind explicitly, e.g.
  `npm run dev -- --host 127.0.0.1 --port 4321`). `npm run build` emits `dist/`;
  `npm run preview` serves that artifact. Data under `data/*.json` is prebuilt and served
  as static assets — no database.
- `worker/` (vision proxy) and `mcp-worker/` (Research MCP) are separate npm projects with
  their own scripts (`wrangler dev`, `vitest`, etc.); they are not required to run the site
  locally. Live vision-scan and MCP features call deployed Workers and external APIs
  (DashScope, Turnstile) whose secrets only exist in the Worker environments, so those
  network-dependent flows cannot be exercised end-to-end from a local checkout without
  credentials.

### Testing

Commands are listed in `README.md` ("Kiểm thử"). Playwright e2e (`npm run test:e2e`)
builds + previews the site itself, so no dev server needs to be running first.

- Known environment caveat: in `mcp-worker`, the test
  `test/domain/legacy-domain-adapter.test.ts` (`loads independently of process.cwd ...`)
  asserts the repository root directory name matches `/CamNangTQCCL$/`. GitHub Actions
  checks out to `.../CamNangTQCCL/CamNangTQCCL`, but the cloud VM checks out to
  `/workspace`, so this single characterization test fails here even though the code is
  correct. It also fails `npm run check:repository` for the same reason. All other
  `mcp-worker` tests (228/229) and every other suite pass. Node symlink resolution
  (real-path) means aliasing the checkout path does not satisfy the assertion; do not
  "fix" it by editing the test.
