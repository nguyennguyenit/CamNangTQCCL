# Astro static migration and Cloudflare Pages research

Research date: 2026-07-23. Sources are limited to current official Astro and Cloudflare documentation.

## Existing compatibility boundary

- The site is one static HTML document with ten hash-selected sections. Hash navigation requires no Astro routes or server fallback.
- Runtime behavior is already browser-only Vanilla JS: native ES modules, `fetch()`, DOM APIs, and `localStorage`.
- The browser currently expects `./data/*.json`; `data/team-tier.json` is optional and the other six loaded files are required.
- The Vision Worker remains a separate deployment and `worker/wrangler.toml` restricts browser CORS to the exact production Pages origin. The Astro migration does not justify merging it into the site.

## Official guidance and implications

### Static output and Vanilla JS

Astro's default `output` is `"static"` and prerenders all pages unless a route opts into on-demand rendering. An adapter is for on-demand/server output, not a prerequisite for a static site ([Astro configuration reference](https://docs.astro.build/en/reference/configuration-reference/), [Cloudflare adapter guide](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)).

Astro explicitly supports interactivity with plain client-side scripts without React, Vue, Svelte, or another UI framework. A processed `<script>` is bundled, converted to a module, deduplicated, and may be inlined. A local script referenced by `src` is documented as processed when it lives under `src/`; a script from `public/` or a CDN must use `is:inline` and is not bundled or optimized ([scripts and event handling](https://docs.astro.build/en/guides/client-side-scripts/), [project structure](https://docs.astro.build/en/basics/project-structure/)).

Implication: retain Vanilla JS, but move the authored `js/` module graph under `src/` and reference its entry from `src/pages/index.astro` with a normal processed `<script src="...">`. Do not preserve the literal `type="module" src="./js/app.js"` tag: extra attributes other than `src` make a script unprocessed, while Astro adds module semantics itself. Do not add a UI integration.

Keeping authored JS outside `src/` has two weaker choices:

1. expose it as unprocessed public content, preserving browser-native module requests but giving up Astro/Vite bundling; or
2. rely on an import from a small `src/` entry into a root-level module graph.

The second may work through the underlying bundler, but the Astro client-script guide does not document it as the supported processed-script layout. It should therefore be treated as an implementation experiment, not the plan.

### Canonical root `data/*.json`

Astro copies `public/` unchanged into the build output, but its configurable `publicDir` is a single directory served at `/`. Setting `publicDir: "./data"` would emit `teams.json` at the output root, not at `dist/data/teams.json`; duplicating or moving the files to `public/data/` would weaken the current root `data/` source-of-truth ([project structure](https://docs.astro.build/en/basics/project-structure/), [configuration reference](https://docs.astro.build/en/reference/configuration-reference/)).

Compatibility-first recommendation: add one static dynamic endpoint under `src/pages/data/` that enumerates the committed root `data/*.json` in `getStaticPaths()` and returns each file's raw bytes from `GET`. Static endpoints run at build time and produce real static files, and dynamic endpoint paths are explicitly supported with `getStaticPaths()` ([Astro endpoints](https://docs.astro.build/en/guides/endpoints/)). This preserves:

- root `data/*.json` as the only maintained artifacts;
- the public `/data/<name>.json` contract in development, preview, and `dist/`;
- independent cacheable JSON files; and
- an adapter-free static deployment.

The endpoint should allow only names obtained from the enumerated directory, return `Content-Type: application/json; charset=utf-8`, and preserve the source text rather than parse/re-serialize it. A build assertion should compare the source and emitted file sets and bytes. The endpoint is preferable to a checked-in duplicate, symlink, or undocumented copy behavior.

Alternative if endpoint generation proves incompatible with the selected Astro version: a small local integration can serve `/data/` through dev middleware and copy the directory in `astro:build:done`. Astro documents `astro:server:setup` for dev middleware and `astro:build:done` for extending generated assets ([Integration API](https://docs.astro.build/en/reference/integrations-reference/)). This is more custom machinery and is a fallback, not the first choice.

### URLs, `site`, and `base`

Set `site: "https://tqccl.pages.dev"` for production URL/canonical generation. Leave `base` unset because this Pages project is hosted at the origin root. Astro uses `base` as the root for pages and assets and exposes it as the built-in `BASE_URL`; hand-authored asset URLs must include that prefix when a non-root base is configured ([configuration reference](https://docs.astro.build/en/reference/configuration-reference/), [environment variables](https://docs.astro.build/en/guides/environment-variables/)).

The existing `./data/...` fetches are compatible with the current single root page and its hash navigation: fragments do not change the document directory, so they resolve under the same deployment root. For compatibility, keep these document-relative fetch URLs during the first migration. Do not change them to leading `/data/...`, which would break a future subpath deployment.

If a non-root `base` is introduced later, verify every hand-authored URL. The robust processed-script form is to construct URLs from Astro's built-in `BASE_URL` value with exactly one slash; Astro notes that `trailingSlash` changes whether it ends in `/`. The initial Pages deployment does not need this abstraction.

### Cloudflare Pages

For static Astro, Cloudflare's current Pages configuration is:

- production branch: `main`;
- build command: `npm run build`;
- build output directory: `dist`;
- root directory: repository root.

Cloudflare documents those exact Astro values and uploads the contents of the output directory ([Astro on Pages](https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/), [Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)). Astro also defaults to `dist/` ([deployment overview](https://docs.astro.build/en/guides/deploy/)).

Do **not** install `@astrojs/cloudflare` for this migration. Current Astro docs say static sites need no adapter, and the current adapter no longer supports Cloudflare Pages; it targets Cloudflare Workers for on-demand routes ([Cloudflare adapter guide](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)). Cloudflare's Pages framework guide still describes adding the adapter for SSR Pages, so the two official surfaces are inconsistent for SSR. That inconsistency is irrelevant if the project stays purely static and adapter-free.

Keep `worker/` and its Wrangler configuration independent. The Pages build must emit only deployable site artifacts; it must not copy `worker/`, `pipeline/`, tests, plans, source HTML/cache, or secrets into `dist/`.

## Recommended architecture

```text
src/pages/index.astro
  ├─ existing semantic HTML, metadata, and section mounts
  ├─ processed Vanilla JS entry from src/
  └─ processed/global CSS from src/

src/scripts/**                authored Vanilla ES modules
src/styles/**                 authored CSS
src/pages/data/[name].json.*  build-time static endpoint
             │
root data/*.json ───────────┴──► dist/data/*.json

astro build (output: static, no adapter) ─► dist/
Cloudflare Pages uploads dist/

worker/ remains a separately tested and deployed Cloudflare Worker
```

This is incremental: first reproduce the existing single page and runtime contracts; only later extract `.astro` components when doing so reduces real complexity. No islands, client directives, content collections, SSR, or framework renderer are needed.

## Build and test gates

Keep the existing Python, Node `--test`, Worker Vitest, and Worker typecheck gates. Add:

1. `astro check` for `.astro` diagnostics in CI. The command is intended for CI; current Astro requires the separately installed `@astrojs/check` and TypeScript packages ([CLI reference](https://docs.astro.build/en/reference/cli-reference/)).
2. `npm run build`, followed by an artifact test that requires `dist/index.html`, all nine canonical JSON files under `dist/data/`, and the built client assets; compares source/emitted data bytes; and rejects accidental publication of private/non-site directories.
3. `npm run preview` against the production build, then browser smoke coverage for all ten hash sections, required/optional JSON behavior, theme and persisted state, and absence of console/network errors. Astro recommends testing production code and documents Playwright with `npm run preview` as its web server ([Astro testing guide](https://docs.astro.build/en/guides/testing/), [develop and build](https://docs.astro.build/en/develop-and-build/)).
4. A Cloudflare preview deployment smoke test before production promotion. Vision calls from a Pages preview hostname will be rejected by the current Worker's exact-origin policy unless that policy is deliberately extended; test local-only features there and test Vision on the production origin, or make an explicit security decision about preview origins.

Playwright is useful for preserving the ten-section/browser contract, but it need not be introduced in the first mechanical commit if the repository wants the smallest dependency change. At minimum, automate artifact checks and retain the existing JS unit suite; add one production-preview browser smoke before calling the migration complete.

## Version-sensitive decisions to verify during implementation

- Pin Astro in `package.json` and commit the lockfile. Current Astro docs are for the latest major and list Node `v22.12.0+` as the present prerequisite; Cloudflare Pages' v3 build image currently defaults to Node `22.16.0` and supports pinning via `NODE_VERSION`, `.nvmrc`, or `.node-version` ([Astro installation](https://docs.astro.build/en/install-and-setup/), [Cloudflare build image](https://developers.cloudflare.com/pages/configuration/build-image/)). Pin a compatible even-numbered Node release rather than relying on a rolling default.
- Confirm the selected Astro version's emitted behavior for the dynamic `.json` endpoint, including exact filenames, MIME type, byte preservation, and dev refresh when a root `data/` file changes.
- Confirm that the processed entry emits a bundled module and that every current relative import survives the move under `src/`; check for accidental double initialization under dev HMR and production preview.
- Confirm `dist/` contains no Cloudflare Function/Worker output and no adapter dependency.
- Confirm Pages project settings still use repository root, `npm run build`, and `dist`; existing dashboard state is not represented by `worker/wrangler.toml`.
- Confirm production and preview URLs before changing `site`, `base`, or Worker `ALLOWED_ORIGIN`. `site` should be the canonical production origin; preview deployments remain root-hosted at separate origins.
- Re-run the URL tests if `base` or `trailingSlash` is ever changed, because `BASE_URL` slash behavior is configuration-dependent.

## Unresolved questions

1. Should the first migration add Playwright immediately, or use artifact checks plus the existing tests and add browser automation in a follow-up?
2. Is `https://tqccl.pages.dev` permanently canonical, or will a custom domain replace it soon enough that `site` should target that domain?
3. Should Cloudflare preview deployments be allowed to call the Vision Worker? The current exact `ALLOWED_ORIGIN` intentionally says no; changing that is a separate security/deployment decision.
