# Report: issue #14, freeze the 68 `book:` ids

`gh issue view 14` returned the full body. Only #14 was read; nothing was edited and no builds were run. Status: OPEN, label `bug`, no comments.

**Issue body vs. brief.**
- The issue offers options A (stable identity), B (301 redirects) and a "minimum" docs fix. The brief picks A only.
- The issue cites `lookup_route_handles.py:33` and `:70`. These are now `LEDGER_NOTE` at `:42` and `_book_id` at `:79`.
- `public/_redirects` already exists and is generated for merged tactics (`pipeline/lookup_route_handles.py:16-19, 240-252`). Option B would extend an existing mechanism, but the brief excludes it.

## 1. Current state

### Data and generator
- `data/books-dict.json` has 68 rows with keys `chinese, viet, hanViet?, sourceNames?, excludedSourceNames?, effect, effectViet, effectVersion`. **No `id` field.**
  - `chinese` is unique across all 68 rows.
  - `chinese` plus `sourceNames` give 125 names, all unique.
  - 35 rows have no `hanViet`.
- `pipeline/lookup-route-handles.json` already holds 68 `books` handles. Each equals the suffix of its id, `retired.books` is empty, and `booksSha256` is `a8507748…ddf77`. That equals the current sha256 of `data/books-dict.json`.
- `pipeline/build_books_dict.py`:
  - `build_books_dict()` builds `{"chinese","viet",…}` rows at `:51-90`. It never emits an id.
  - It sorts rows by `viet` at `:88`.
  - `build()` overwrites `data/books-dict.json` at `:97-106` (`_OUT` is `:36`, `_MAP` is `:35`).
  - The input is `pipeline/books-han-viet-map.json`, `{"books": {chinese: viet | {viet, outsideTeams?, sourceNames?, effect…}}}`. It has a `_note` key, and entries are a mix of strings and dicts.
- Tactics precedent:
  - `data/tactics.json` rows carry `id: "tactic:an-ui-quan-dan"`, with `lookup.formerIds` (`[]` or a list of old ids).
  - Consumers read `row.id` and use `createFormerTacticIdIndex` at `js/lookup-ids.js:71-81`.
  - Tactic ids come from the lookup pipeline, so books have no equivalent today.

### Producers that derive the id from the Vietnamese name
| Site | Evidence |
|---|---|
| `bookLookupId` | `js/lookup-ids.js:18-21`, slug of `viet ?? hanViet` |
| Same file, other derivations | `:42-44` (`bookSourceAliases` keys by `lookupSlug(viet)`); `:147` (resolver `bookIds`); `:177` (`byVi(bookIds,"book",vi)` builds `book:${slug}`) |
| `_book_id` | `pipeline/lookup_route_handles.py:79-83`, used in `load_corpus` at `:108` |
| Ledger slug minting | `mint_handles` slugs `_name(row)` at `:146`. Slug equals the id suffix only because the id is itself name-derived. |
| `entityId` / `recordEntityId` | `js/analyze-map.js:59-77`. Only `tactic` honours `record.id` (`:75`); books go to `slugOf(viet)` (`:69-70`). |
| `createEntityIndex` | `js/analyze-map.js:164-170`. It is built per kind in `js/analyze.js:392-394` and `js/community-team-data.js:56-58`. |
| `nameEntry("book", name)` | `js/analyze-map.js:385-388` and `:410, :422`. It computes the reference-team book id from the stored Vietnamese name. `diffTeam` compares `slot.book.ids.includes(member.book)` at `:~506`. **After a rename this gives false mismatches.** There is no `bookIdOf` parameter; tactics have `tacticIdOf` (`:397, :485, :543`). |
| Season JS | `js/season-context.js:134-143` (`dictionary(rows,kind)`, key `${kind}:slug(viet)`); `js/render.js:1013-1016` (`seasonConfigDetail` names map) |
| Season Python | `pipeline/season_validation.py:60-85` (`dictionary_ids`, `slug(viet)`). It is called from `pipeline/build_season_data.py:273-282` and `pipeline/promote_unified_lookup.py:306-320`, where books are passed as `[]`. |
| Unified lookup | `js/unified-lookup.js:104-123` (`bookRecords` calls `bookLookupId`) |
| MCP builder | `mcp-worker/src/data/publication-builder.ts:313-317` (`bookLookupId`, then `lookupProfilePath` routable check) |
| MCP identity | `mcp-worker/src/data/entity-identity.ts:20-33`. `canonicalDictionaryId` already prefers `recordId` for books. It is used at `snapshot-index.ts:54` and `artifact-contracts.ts:295`, so adding `id` to rows is picked up automatically. Its name-slug fallback still applies to books and must be removed. |
| Route loader | `src/lib/lookup-detail-routes.ts:14, 58-71, 107, 142` (pins `booksSha256` and `generationId`). `exceptions` = entries whose slug differs from `lookupDerivedSlug`. |
| Slug derivation | `js/lookup-ids.js:269-273`. `lookupItemPath` (`:307`) uses the exceptions table, else the id suffix. |

### Consumers that only need to carry the id (not derive it)
- `js/analyze-state.js:18-25, 70`: `?doi=` encodes `id.slice("book:".length)` and decodes back to `book:<slug>`. The localStorage history (`tqccl.analyze.history.v1`) stores that `doi` string. Both are stable as long as ids are frozen.
- `community-worker/src/validate.ts:12, 36-39` and `routes/scan.ts:85-100`: shape-only regex `^book:[a-z0-9]+(-[a-z0-9]+)*$`. They derive nothing and **do not need changes**.
- `js/lookup-detail.js:404` (`startsWith("book:")`), `src/lib/team-detail-pages.ts:96-101, 171-187`, `src/lib/team-ssr.ts:47`, `js/recommended-reference-render.js:~167` (link tables map name → id through `createLookupIdResolver`). `team-detail-pages.ts` follows `createLookupIdResolver` automatically.
- `src/lib/lookup-pages.ts:75-78`, `src/lib/root-static-artifacts.ts:316-332` (hash pin and `lookupBookAliases`), `src/layouts/SiteLayout.astro:202-206`, `js/app.js:70-81` (pin check `#lookup-books-hash`): all read raw bytes. Adding `id` changes those bytes, so the pin changes.

### Naming trap
`pipeline/recommended-identity-map.json` has `stableId: "book:<24-hex hash of chinese>"` (66 hits) and 73 `kind:"book"` entries. This is a separate identity space (`pipeline/recommended_identity.py:159`) and is not a lookup id. Do not conflate them or "freeze" them.

## 2. Storage decision

Emit `id` as a field on each `books-dict` row, as tactics do. The open question is where the generator gets the id.

**Trap in the "chinese → id" keying.** `docs/project-changelog.md:298` records that the Hán names of three books were corrected (`出其不意`→`出奇制胜`, `顺应天时`→`顺天应时`, `以武止戈`→`以治击乱`). A ledger keyed by `chinese` would mint a new id (or fail) on such a correction.

**Recommendation.**
- Add `"id": "book:…"` to each entry in `pipeline/books-han-viet-map.json`. All 68 entries become objects, since many are bare strings today. The id travels with the entry and survives a Hán correction.
- The generator reads `id` and copies it to the row. It never calls a slug function on an existing row.
- A new entry without `id` fails loud, or is minted once by an explicit CLI step as `slug(viet)` with `-2` on collision. That is the one place a name is slugged, and only for brand-new books.
- It validates that ids are unique, shaped `book:[a-z0-9-]+`, and that no id has disappeared.
- Freeze guard: a committed snapshot such as `tests/fixtures/book-ids-frozen.json` ({id: chinese at freeze time}, 68 entries). Fixed ids can be asserted with `assertEqual` against it.

**Alternative, closer to the brief's wording:** a separate pinned file such as `pipeline/books-id-ledger.json` of `chinese → id`, with a `retired` list and a digest like the route-handle ledger. This is more machinery. It needs an explicit "rename chinese" step, but it gives an immutability checker. The main agent should choose; my pick is the embedded `id` plus the frozen snapshot test.

**Consumers after the change.** A row without a valid `id` is dropped, as `bookLookupId` already drops rows with no name. JS then reads `row.id`. The corpus builder, MCP builder and season validators fail closed instead of falling back to `slug(viet)`.

**Resolver changes** (`createLookupIdResolver`, `js/lookup-ids.js:144-161`, and the `analyze-map` index):
- `bookIds` becomes the set of `row.id`.
- `byVi` for books becomes a map `slug(viet) → row.id`, not `` `book:${slug}` ``.
- `analyze-map.nameEntry` for books needs a `viet → id` index parameter, the equivalent of `tacticIdOf`.
- Teams data and `bookSourceAliases` still match books by their stored Vietnamese name.
  - After a rename, old stored names no longer resolve.
  - Books have no `formerNames` field like tactics' `formerIds`.
  - Decide whether to add a row-level `formerViet` or `aliasesVi`, or accept that those links drop to plain text. **[INFERENCE]** The brief says "đổi tên đi qua lookup/Soi đội/lịch sử/link ?doi=", which implies names resolve through the stored `chinese` / `sourceNames`.
- `bookSourceAliases` (`js/lookup-ids.js:38-64`) joins `recommended-identity-map` `displayNameVi` to a book by `slug(viet)`. After a rename this join silently loses aliases and `formerNames`. It keys output by id, but the lookup is still by name. Make it join by `chinese` / `sourceNames`, or add a rename test.

## 3. Files to change

### Pipeline and data
- `pipeline/books-han-viet-map.json`: add `id` to all 68 entries.
- `pipeline/build_books_dict.py`: emit `id`, validate uniqueness and shape, mint only for new entries. `tests/test_build_books_dict.py` has `build_books_dict(m, FACET)` calls with bare dicts and needs updating.
- `data/books-dict.json`: regenerate with `python3 -m pipeline.build_books_dict`. Byte changes mean a new sha256.
- `pipeline/lookup_route_handles.py`:
  - `_book_id` (`:79`) reads `row["id"]`, with fail-closed behaviour.
  - `LEDGER_NOTE` (`:42`) is corrected to describe books truthfully.
  - `ledger_problems` does not check `note`, and `handlesSha256` does not cover it. A note-only change therefore does not break pins; it only changes the ledger bytes when `--write` is run.
- `pipeline/season_validation.py` `dictionary_ids` (`:60-85`): books use `row["id"]`. Keep the existing ambiguity rule.
- `pipeline/lookup-route-handles.json`: `--write` rewrites it with the new `booksSha256` and note. Handles are unchanged.
- `public/_redirects`: regenerated (unchanged content). `--check` fails if stale.

### JS and TS
- Edit `js/lookup-ids.js` (`bookLookupId`, resolver, `bookSourceAliases`).
- Edit `js/analyze-map.js` (`recordEntityId`, `createEntityIndex`, `nameEntry`/`referenceTeam` book id lookup).
- Edit `js/season-context.js` (`dictionary`) and `js/render.js:1013-1016`.
- Edit `js/unified-lookup.js` (comment at `:104` plus `bookRecords`).
- Edit `js/analyze.js` and `js/community-team-data.js` if the book resolver is threaded through.
- Edit `mcp-worker/src/data/entity-identity.ts` (drop the name-slug fallback for books).
- `mcp-worker/src/data/publication-builder.ts` needs no change beyond the shared `bookLookupId` update.

### Docs
- `docs/unified-lookup.md:136`: the "slug frozen by id" claim.
- `docs/system-architecture.md:118`: the same claim, plus the "Build refuses ledger with wrong `books-dict` hash" wording.
- `README.md:111`, `docs/deployment-guide.md:106-112`, and `docs/project-changelog.md:131` (add a new changelog entry).
- `docs/codebase-summary.md:85` (68 rows).
- Add a "how to add a book / frozen ids" note to `docs/unified-lookup.md`.

### Pinning
- **sha256-pinned in `pipeline/site-localization-policy.json` `sourceFiles`:** `js/analyze-map.js`, `js/analyze.js`, `js/app.js`, `js/lookup-detail.js`, `js/recommended-reference-render.js`, `js/render.js`, `js/unified-lookup.js`, `src/lib/root-static-artifacts.ts`, `src/layouts/SiteLayout.astro`. Not pinned (verified): `js/lookup-ids.js`, `js/season-context.js`, `js/analyze-state.js`, `js/community-team-data.js`, `src/lib/lookup-detail-routes.ts`, `src/lib/team-detail-pages.ts`.
- **In `mcp-worker/workflow-source-manifest.json` `semanticFiles`:** `js/analyze-map.js`, `js/lookup-ids.js`, `js/season-context.js`, `js/hero-identity.js`, `mcp-worker/src/data/entity-identity.ts`, `mcp-worker/src/data/publication-builder.ts`. Editing any of these requires `cd mcp-worker && npm run generate:workflow-build`; `npm run check:workflow-build` verifies it (UNVERIFIED that it currently passes).

## 4. Existing tests to extend
- `tests/test_build_books_dict.py` (note: `test_real_map_against_real_facets` compares `built == committed` at `:86-92`).
- `tests/test_lookup_route_handles.py`. Fixtures at `:28-45` and `:240` have books without `id`, and the id assertions are at `:87, :95`.
- `tests/test_build_season_data.py:230` (books without `id`).
- `tests-js/lookup-ids.test.mjs:40-41, 53-74, 103, 170-191`.
- `tests-js/unified-lookup.test.mjs:133` (fixture "dạng thật… không có id"), `:207, :314-316, :333-390`.
- `tests-js/analyze-map.test.mjs:337, 413-429, 576`.
- `tests-js/analyze-state.test.mjs:16-64`.
- `tests-js/season-context.test.mjs` and `tests-js/fixtures/season-fixtures.mjs:23`.
- `tests-js/lookup-detail-routes.test.mjs:14`.
- `tests-js/astro-dist-contract.test.mjs:136, 1540-1558` (fixture books are built from `booksBytes`).
- `mcp-worker/test/data/publication-snapshot.test.ts:331-344` (`books:[{viet:"Sách",…}]` expects `book:sach`).
- `mcp-worker/test/research/entity-ref-names.test.ts:29` (`book:binh-hanh-quy-dao`).
- `mcp-worker/test/data/artifact-contracts.test.ts:144-174`.
- `mcp-worker/test/fixtures/lookup-roots.ts`.
- `community-worker/test/scan.test.ts` (shape only, no change needed).

### Verification commands (from `package.json`, `docs/deployment-guide.md`, `README.md:64`, `docs/code-standards.md:161`)
```
python3 -m unittest discover -s tests            # or: python3 -m unittest tests.test_build_books_dict tests.test_lookup_route_handles tests.test_build_season_data
node --experimental-strip-types --test tests-js/*.test.mjs   # npm run test:node
python3 -m pipeline.build_books_dict
python3 -m pipeline.lookup_route_handles --write && python3 -m pipeline.lookup_route_handles --check
npm run build && npm run verify && npm run test:dist
cd mcp-worker && npm run check            # includes check:workflow-build, check:knowledge-bundle, tests, typecheck
cd community-worker && <test command>     # [UNVERIFIED]
```
Pages publication chain (`docs/deployment-guide.md` section "Publish lại bản dịch hiển thị"): re-pin the policy hashes (`sourceFiles`), then `inventory`, `build`, `check`, `publish`, re-pin `generationId` in `pipeline/team-route-handles.json`, `pipeline.team_route_handles --check`, then `npm run build && npm run verify && npm run test:dist`. Editing any pinned file triggers it, so the chain is required.

## 5. Downstream pins and releases
- **`booksSha256` in `pipeline/lookup-route-handles.json`** repins with `--write`. `SiteLayout.astro:206` and `js/app.js:75` check the hash in HTML against the file; `scripts/verify-astro-dist.mjs:436-437` checks where the pin appears.
- **MCP worker release.** Worker assets embed `books-dict.json` bytes, so the release id changes. The docs describe a seasonal release (`docs/mcp-research-server.md:112-123`), and the brief already makes this a single release. MCP entity ids stay the same (`book:<same slug>`).
- **`mcp-worker/test/.worker-assets/*` and `mcp-worker/test/fixtures/release-snapshot/manifest.json`** hold test fixtures with books bytes or hashes. Whether they are tracked or regenerated at test time is **[UNVERIFIED]**; `git ls-files mcp-worker/test/.worker-assets` returned nothing.
- **Season data and `website-display.json`.** `data/website-display.json` has no `books` string, but it pins source hashes. Whether `books-dict` is in its `sourceHashes` is **[UNVERIFIED]**; the `policy.sourceFiles` edits above force a republish anyway.

## 6. TDD matrix (write failing first)
1. **Generator idempotence:** `build_books_dict` over the real map gives ids identical to the frozen snapshot (68 ids, committed fixture).
2. **Rename test:** change `viet` of one entry (e.g. `Dĩ Trực Báo Oán` → `Lấy Thẳng Báo Oán`). The output id stays `book:di-truc-bao-oan`. `lookup_route_handles --write` leaves `handles` unchanged, `retired` empty, and `--check` passes.
3. **Chinese correction:** change the `chinese` key of an entry while keeping its `id`. The id stays the same (the case in `docs/project-changelog.md:298`).
4. **Fail-closed:** an entry without `id`, a duplicate id, or a malformed id each raise; an entry with `id` but no name does not crash.
5. **Resolver:** `createLookupIdResolver({books}).book(raw, vi)` returns the frozen id after a rename, by `chinese` and `sourceNames`, and by the old `viet` if a former-name mechanism is added. It never returns `book:<slug of viet>` unless that equals a row `id`.
6. **Lookup corpus and URL:** `buildLookupCorpus` builds entries with the frozen id; `lookupHref(id)` gives `/tra-cuu/binh-thu/<same slug>/` after a rename, with `lookupRouteExceptions` empty.
7. **Soi đội diff:** a reference team using the old stored Vietnamese name still yields `book.status: "match"` when the user's book id is the frozen id (catches the `nameEntry`/`slugOf` bug).
8. **`?doi=` and history:** a share link built before the rename (`…_giap-sat`) decodes after the rename, and `hasId` accepts it. History entries load.
9. **Season:** `dictionary_ids` (Python) and `dictionary()` (JS) return frozen ids; `canonicalRef {kind:"book", id}` validates after a rename.
10. **MCP:** `publication-builder` entity id and `tqccl_get_entity` accept the old id after a rename. `snapshot-index` / `artifact-contracts` reject a duplicate id and have no name fallback for books.
11. **Ledger and docs consistency:** `LEDGER_NOTE` no longer claims names do not derive ids for books. A test or grep asserts that `docs/unified-lookup.md:136` and `docs/system-architecture.md:118` match the new text.
12. **Dist contract:** `astro-dist-contract` fixture books carry ids. The dist stays free of name-derived book routes when `viet` is changed in the fixture.

## 7. Risks and traps
- **Chinese-keyed ledger fragility** (see section 2): Hán corrections have happened before.
- **`mapName` canonicalId for books** (`js/analyze-map.js:116-119`) passes `kind:"tactic"` to `recordEntityId` for every matched non-hero record, books included. That yields a `tactic:<slug>`-style canonicalId for a book. I did not trace its effect and mark it **[UNVERIFIED]**. It is used only in `findSimilarTeams`/MCP flows (`:566-589`, `:607`).
- **Aliases and former names:** nothing resolves old Vietnamese book names today, so teams data using an old name stops linking after a rename. Decide the mechanism (see the Resolver bullet in section 2).
- **Fallback removal in `entity-identity.ts`** changes behaviour for any books-dict fixture without ids. Many mcp-worker tests do this (`publication-snapshot.test.ts:331`), so expect fixture edits.
- **Order of rows:** `books-dict` is sorted by `viet`. A rename reorders rows and changes bytes and the hash. That is acceptable, but each rename needs `lookup_route_handles --write`.
- **Pins:** whichever of `lookup-route-handles.json`, `site-localization-policy.json`, `workflow-build.ts` and the localization publication chain gets skipped, `npm run build` or `verify` fails.
- **Shared serial lane (#14 → #5 → …):** this PR edits files pinned in the policy (`js/render.js`, `js/analyze-map.js`, `js/unified-lookup.js`), so later PRs in the chain must rebase and re-pin.
- **Brief gaps:**
  - It does not mention `bookSourceAliases` (name join) or `nameEntry` / `referenceTeam` (Soi đội diff), which are the likeliest consumer-visible bugs.
  - It does not mention the MCP asset and workflow regeneration.
  - It does not decide how old Vietnamese names resolve after a rename.
  - It does not mention `LEDGER_NOTE` excluding `note` from `handlesSha256`; editing it is safe.
- **Not examined:** `.agents/skills/tqccl-coexist-team-builder/SKILL.md` and `docs/design/**` mention `book:`; they look like docs only, but I did not read them.