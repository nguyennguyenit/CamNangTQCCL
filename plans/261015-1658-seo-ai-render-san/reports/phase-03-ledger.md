# Phase 3 / B1 — frozen lookup slug ledger

## Delivered
- `pipeline/lookup_route_handles.py` (`--write` appends only, `--check` validates, never re-derives), `pipeline/lookup-route-handles.json` (886 ids), `tests/test_lookup_route_handles.py`, `src/lib/lookup-detail-routes.ts`, `tests-js/lookup-detail-routes.test.mjs`.
- Counts: heroes 202, tactics 406, equipment 114, books 68, advisors 39, buildings 41, troop-mods 16 = 886. `equipment-special:*` excluded.

## Decisions
- Python reads the corpus straight from `data/*.json` (same sources as `buildLookupCorpus`; the only derived ids are books via `bookLookupId`, reimplemented with JS `??` semantics: empty `viet` is kept, so such rows are dropped, as in JS). No node subprocess: the files are plain JSON and the precedent (team ledger) is also pure Python. Parity with JS `lookupSlug` is tested both ways: py unit tests on the rule, node test that every ledger slug equals `lookupSlug(nameVi)` (+ optional `-N`) over the real JS corpus, and that the ledger key set equals JS corpus ids.
- Ledger schema v1 keys: `schemaVersion, generationId (data/lookup-manifest.json), booksSha256 (data/books-dict.json, outside the manifest), handlesSha256 (canonical JSON digest of handles → catches hand edits), note, handles{group:{id:slug}}`.
- Collision: `-2`, `-3`… in corpus order, skipping slugs already taken. Rename keeps slug (frozen by id). `--write` on existing ledger keeps all slugs, appends new ids, refreshes pins; refuses if the ledger has vanished ids/bad slugs/hand edits. `--check` fails on missing id, unknown id, duplicate/malformed slug, stale pins, digest mismatch.
- TS loader `lookupDetailRoutes()` / `parseLookupDetailLedger(raw, corpusIds, pins)`: exact key-set vs corpus ids per group, slug shape/uniqueness, digest, optional pins; returns `{entries, byId, bySlug(group, slug)}` with `{id, group, slug, path:'/tra-cuu/<groupSlug>/<slug>/'}` (vi path; locale prefix is the caller's job). Default corpus = `lookupBuildCorpus()` + publication generationId + books hash (dynamic imports; only exercised at build time, not by the node test, which injects `corpusIds`).

## Slug collisions in the current corpus
None (0). All 886 base slugs are unique within their group; no `-N` suffix present.

## Evidence
- `python3 -m pipeline.lookup_route_handles --write` → `ledger: 886 ids, 886 new, 0 new collisions`; `--check` → `ledger ok: 886 lookup ids frozen`.
- `python3 -m unittest tests.test_lookup_route_handles` 16 OK; `python3 -m unittest discover tests` 422 OK.
- `node --experimental-strip-types --test tests-js/lookup-detail-routes.test.mjs` 4/4 pass.
- Not run (per instructions): build, verify, e2e, full test:node. Not touched: js/, pages, sitemap, verify-astro-dist, localization policy (no sourceFiles/semanticFiles changed).

## Left for later phases
- Wire `lookupDetailRoutes()` into `[group]/[slug].astro` + sitemap + dist contract. If `pipeline/lookup-route-handles.json` or new TS must be registered anywhere (e.g. dist allowlists) that is for the route-wiring phase. Rerun `--write` when lookup data generation changes (`--check` fails on stale pins by design).
