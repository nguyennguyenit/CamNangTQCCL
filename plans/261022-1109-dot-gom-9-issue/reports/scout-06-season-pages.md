# Issue #6 remainder (season pages): evidence report

Nothing was edited. I ran only `python3 -m pipeline.site_localization check --root . --stage public`, which passes on the current tree.

## 0. Corrections to the issue and brief
- **Already shipped (PR #9, per the brief's production check):** prerender of 4 sections + detail pages, team JSON-LD, `llms-full.txt`, the `llms.txt` lookup links. What remains is season pages plus dropping `?season=`.
- **Đội khác has no season data.**
  - All 40 rows of `other-teams.json` have `sourceSeasonIds: null` and `seasonAttribution: []`.
  - `seasonMatches` (`js/recommended-reference-state.js:127-132`) therefore puts them all in `all`/`unknown`, and every real season is empty.
  - The issue line "Đội khác áp dụng cùng mô hình theo mùa" can only produce degenerate pages. **Needs a decision from Main/user.**
  - Đội khác also lists 40 variants while it has 166 detail routes (`data/teams.json`).
- **Season counts** (from `index.json`, 1366 rows, 26 collected seasons):

  | Group | Count |
  |---|---|
  | OG | 25 |
  | S1 / S2 / S3 | 30 / 31 / 29 |
  | PK | 1251 |
  | pk-s26 (largest) | 130 (108 giao chiến + 22 khai hoang) |
  | pk-s16 / s18 / s25 / s17 | 111 / 110 / 107 / 107 |

  - Other seasons are 93 (s28), 82 (s24) and 76 (s27); the other collected seasons are at most 84.
  - The 3 uncollected seasons (`pk-s21`, `pk-s20`, `pk-s15`) have 0 teams and scope state `uncollected-season`.
  - The registry advertises 88 for pk-s19 but only 84 rows exist.
  - Each season fits one page (≤130 cards, grouped by tier), so no pagination is needed for PK. If pagination is wanted, `PAGE_SIZE=60` (`js/team-filter-section.js:139`) would split 9 seasons into 2 pages.

## 1. Current state

### Season slug
- The detail slug is `<displayCode lowercased>-<handle>` (`src/lib/team-detail-routes.ts:314-322`), with `routeSeasonSegment` at `:21-27`. Season codes are `og`, `pk-s28`, `s1`.
- `sourceSeasonId` for OG is CJK (`og-兵演春秋`), so the season-page slug must come from `displayCode.toLowerCase()`.
- The registry is `seasons.json` (`defaultSourceSeasonId`, `seasonOptions[]` with `displayCode`, `displayNameVi`, `nameRaw`, `status`, `advertisedCountRaw`). No code reads the filesystem for it today. `recommendedSeasonOrder()` (`src/lib/team-detail-pages.ts:77-83`) and `recommendedSeasonNamesRaw()` (`:64-74`) read it from `websiteDisplayPublicationSnapshot().recommended.files['seasons.json']`.
- `src/lib/llms-documents.ts:71-104` already groups by season, with a 300 KB split. It uses `lookupSlug(code)` and emits `/llms/doi-chuan/<slug>.txt`. Reuse that slug rule for consistency.

### Routes and pages
- `src/pages/doi-chuan/index.astro` and `src/pages/doi-khac/index.astro` are 5-line shells that render `SectionPage section="team-chuan"` / `"team-khac"`. The zh copies live in `src/pages/zh/doi-chuan/` and `src/pages/zh/doi-khac/` (`index.astro` and `[team].astro`).
- `[team].astro` calls `recommendedDetailPaths(locale)` (`src/lib/team-detail-pages.ts:230-265`) and `legacyDetailPaths` (`:279-313`).
- `SectionPage.astro:81-83` sets the canonical URL to `localePath(page.path, locale)`. It prerenders via `teamSectionParts` (`src/lib/team-ssr.ts:172-183`) → `recommendedSectionTrees` (`src/lib/team-section-ssr.js:42-58`).
- The default state comes from `referenceSectionState` (`js/recommended-reference-state.js:106-110`):
  - Đội chuẩn defaults to `registry.defaultSourceSeasonId`.
  - Đội khác forces `season:'all'` when the URL has no `season` param.
- The prerender limit is `PAGE_SIZE=60`, so OG's 25 rows render in full. Other seasons exceed 60 and need `limit` raised or pages split.

### Detail page title, H1, JSON-LD
- Detail title is `pageLabel + ' — Đội chuẩn — …'` (`RecommendedDetail.astro:60`). `pageLabel` is `"<name> (<code>[ · n])"` (`team-detail-pages.ts:252-257`), so it contains the season **code**, not the name.
- The kicker line `<p class="scope-note detail-kicker">` already shows `code · season name · category` (`RecommendedDetail.astro:81-82`). The H1 is only the team name (`:83`).
- JSON-LD is built by `teamDetailJsonLd` (`src/lib/structured-data.ts:40-57`) with `name=pageLabel` and a description that includes `scopeLine`. It emits a WebPage with `isPartOf` VideoGame, plus a BreadcrumbList of home › family › page.
- There is no "mùa cũ" label anywhere in the code.
- The season registry is the right source for "mùa cũ": `entry.sourceSeasonId !== defaultSourceSeasonId`.
- `team-filter-section.js:165` hardcodes `CURRENT_SOURCE_SEASON_ID='og-兵演春秋'` for the "Hiện tại" chip. That duplicates the registry default and would drift when a new season ships.

### Dropdown and `?season=` handling
- `createRecommendedSection` (`js/team-filter-section.js:210+`) builds a `<select aria-label="Mùa">`:
  - The change handler is at `:258`: `onQuery({season,...}, true)`.
  - The options are `all`, `unknown` (Đội khác only), then the registry options (`:305-316`).
- `navigateReference` (`js/app.js:341-354`) writes URL params with `history.pushState`/`replaceState` and then re-renders from `location.href`.
- `renderReference` (`js/app.js:428-436`) calls `referenceSectionState(..., location.href, ...)` for both sections.
- `readRecommendedQuery` (`js/recommended-reference-state.js:72-99`):
  - An unknown season produces a notice and falls back to the default.
  - `season=all` and `unknown` are special-cased.
- **Trap:** `readRecommendedQuery` is also the reader for **Soi đội** (`js/analyze.js:952`) and **Gợi ý đội** (`js/roster-recommend-ui.js:180`), which keep `?season=`. Those pages are out of scope, so `season` must stay in `SCALARS`.

### Return links and navigation
- `SECTION_QUERY_KEYS` (`js/team-detail-navigation.js:25-35`) is a pathname allowlist. `normalizedSectionTarget` (`:204`) returns null for any pathname not in it.
- **A new `/doi-chuan/mua/<slug>/` path is rejected by `safeReturnUrl`.** That breaks `from=` return links, snapshot capture and match, `captureReturnSnapshot` and `matchesReturnSnapshot`, and `team-detail.js:30-35 upgradeReturnLink`.
- `familyReturnHref` (`:232-241`) builds `?season=<sourceSeasonId>`. `RecommendedDetail.astro:25` is its SSR caller (`familyReturnHref('recommended',{sourceSeasonId,locale})`). `sourceSeasonId` is CJK for OG, so a slug argument must be passed.
- `team-ssr-adopt` signature (`team-filter-section.js:159`, `referenceViewSignature`) embeds `state.season`. The ssr stale guard (`src/lib/team-section-ssr.js:121-136`) keys off `SECTION_QUERY_KEYS[...]`.
- The client replaces the header: `mount.replaceChildren(el('header' …))` (`team-filter-section.js:279`). Only `.reference-view` is adopted, so the client H1 is always the plain "Đội chuẩn". A season H1 must be rendered by the client too, or it flips on boot.

### Legacy redirect
- `/?season=…#team-chuan` is handled by `js/legacy-routes.js:11-82` (frozen `ROOT_KEYS` includes `season`). It is inlined into the Landing head (`Landing.astro:177`, id `legacy-route-redirect`).
- It outputs `/doi-chuan/?season=…`.
- It has no registry or slug knowledge, so the `?season=` → path redirect has to be a second hop on the section page.
- Cloudflare `_redirects` (`public/_redirects`, a generated file) cannot match query strings. The redirect therefore has to be a client script, like the existing `lookup-hub-redirect` inline head script in `LookupHubPage.astro:33`.
- Old ids such as `s26` do not exist in the registry (`s1`–`s3` and `pk-sNN` only). `/?season=s26#team-chuan` therefore currently resolves to the default season with the notice "Mùa không tồn tại".

### Tra cứu link (cross-season)
- `js/lookup-profile.js:349` and `js/lookup-tactic-profile.js:268` link to `/doi-chuan/?season=all&q=…`.
- Asserted at `tests-e2e/unified-lookup.spec.mjs:546-551`: `/^\/doi-chuan\/\?season=all&q=/`.
- Cross-season search has no natural static home. **Decision needed:** keep `?season=all&q=` as a client-only view, or point it elsewhere.

### Sitemap and verifier
- `sitemap.xml.ts:159-173`, `GET`: builds routes from `mirroredSitemapPaths([...catalog.*.routePath, ...lookup])` (`:63-65`). `sitemapLocations` (`:116-133`) throws on duplicate URLs.
- `scripts/verify-astro-dist.mjs`:
  - `:268-285` is the `expectedFiles` allowlist.
  - `:295-301` is the unexpected/missing mismatch throw.
  - `:309-321` is a byte-equality check of `sitemap.xml` against `sitemapDocument(...)`. It uses the same `mirroredSitemapPaths` inputs, so the season paths must be added **in both places**.
  - `:363-440` checks the section pages (an `APP_PAGE_PATHS` loop, with `SEASON_SECTION_PATHS` at `:361`).
  - `:555-590` checks that detail `<title>`/description are unique.
- Canonical and hreflang:
  - `SiteLayout.astro:77-81` builds alternates via `mirroredAlternates(pathname)` (`src/lib/locale-routes.ts:41-44`), and canonical from the `canonicalUrl` prop (`:84,380`).
  - Season pages automatically get vi↔zh hreflang if both exist. `verifyLocalePair` (`verify-astro-dist.mjs:90-98`) checks it.

## 2. Files to change

**Not pinned and not in the MCP manifest** (free to edit):
- New route module: `src/lib/season-pages.ts`. It builds the inventory (slug from `displayCode`, a counts/`collected` flag, ordering and an `isCurrent` flag) from `seasons.json` and `index.json`. Sitemap, verifier, llms and pages should all import it. It must be fixture-safe: the dist fixture's registry is empty (`astro-dist-contract.test.mjs:268`), which yields 0 season pages.
- New pages: `src/pages/doi-chuan/mua/[season].astro`, `src/pages/zh/doi-chuan/mua/[season].astro`, and the Đội khác equivalents if kept.
- New component, if a shell is wanted: `src/components/pages/SeasonPage.astro`.
- `src/lib/team-detail-pages.ts` (`recommendedDetailPaths`: season name in title/pageLabel/H1 data plus a `staleSeason` flag).
- `src/lib/structured-data.ts` (season name, a new season-page builder; breadcrumb extension).
- `src/lib/team-section-ssr.js`, `src/lib/team-ssr.ts` (season-scoped rows, limit), `src/pages/sitemap.xml.ts`, `scripts/verify-astro-dist.mjs`, `src/lib/llms-documents.ts` (optional link to season pages).
- `docs/code-standards.md` (`:46,52,70,77`), `docs/deployment-guide.md:104`, `docs/design-guidelines.md:28-29`, `README.md:9-14`, and `docs/project-changelog.md`.

**Pinned in `pipeline/site-localization-policy.json` `sourceFiles`** (any change breaks `build` and `verify` until re-pinned and republished):
- `src/pages/doi-chuan/index.astro`, `src/pages/doi-chuan/[team].astro`, `src/pages/doi-khac/index.astro`, `src/pages/doi-khac/[team].astro`
- `src/components/pages/RecommendedDetail.astro`, `src/components/pages/SectionPage.astro`, `src/layouts/SiteLayout.astro`, `src/pages/index.astro`
- `src/lib/team-detail-routes.ts`
- `js/app.js`, `js/team-filter-section.js`, `js/recommended-reference-state.js`, `js/recommended-reference-render.js`, `js/team-detail-navigation.js`, `js/team-detail.js`
- `js/legacy-routes.js`, `js/lookup-profile.js`, `js/lookup-tactic-profile.js`, `js/analyze.js`, `js/roster-recommend-ui.js`
- `src/components/landing/Landing.astro`

Notes on the pins:
- Re-pinning means the "Publish lại bản dịch hiển thị" chain (`docs/deployment-guide.md:251-271`): hash pins, `baseline.notes`, build, check, publish, re-pin the generationId in `team-route-handles.json`, then `npm run build && npm run verify && npm run test:dist`.
- The pin check is enforced in `check` at `pipeline/site_localization.py:2438-2440`.
- New `src/pages/**/*.astro` and `src/lib/*.ts` files are not required to be in `sourceFiles`. Only `REQUIRED_OWNER_FILES` (`:63-68`) are mandatory.
- **UI-obligation snippets** (`pipeline/site_localization.py` ~`:280-604`) must still appear verbatim in their files, or `check` fails with "reviewed UI source expression is missing". Preserve these when editing:
  - In `js/team-filter-section.js`: `L('Mùa','赛季')`, `'Xem thêm'`, `` `Mỗi lượt hiện ${PAGE_SIZE} đội` ``, the introduction line "Đội hình tham khảo, chia theo mùa tương ứng.", and the view/filter labels.
  - In `SectionPage.astro`: the `doi-chuan`/`doi-khac` titles and descriptions.
  - In `RecommendedDetail.astro`: the title/tagline/back/score strings (`:315-318, 602-604`).
- Season pages ship new vi/zh UI strings. Whether the localization inventory requires new policy locations or a routeFamily for them is **[UNVERIFIED]**. The existing families are in `routeFamilies`/`sections` (`recommended-detail`, `team-chuan`, `team-khac`).

**MCP `workflow-source-manifest.json` semanticFiles** (do NOT edit; a change forces an MCP re-release and regenerating `workflow-build.ts`): `js/season-context.js`, `js/i18n.js`, `js/website-display.js`, `js/lookup-data.js`, `js/lookup-field-labels.js`, `js/lookup-ids.js`, `js/roster-scan-state.js`, `js/roster-season-candidates.js`, `js/analyze-map.js`, `js/filters.js`, `js/hanviet.js`, `js/hero-identity.js`, `js/match-dict.js`, `js/lookup-innate-holders.js`, `js/team-recommend-engine.js`. Of the files above, only `js/roster-scan-state.js` and `js/analyze-map.js` are in both the policy pins and the MCP manifest. The MCP manifest also lists 34 `mcp-worker/src/**` files.

## 3. Existing tests to extend, and commands

**Node tests** (`npm run test:node` = `node --experimental-strip-types --test tests-js/*.test.mjs`):
- `tests-js/recommended-reference-state.test.mjs` (4 `season=` lines)
- `tests-js/team-detail-navigation.test.mjs` (17: `:85-86, 167-188, 232-235, 251-261, 316-320, 562`)
- `tests-js/legacy-routes.test.mjs` (`:52,65,78,99`; likely unchanged if the redirect is two-hop)
- `tests-js/team-section-ssr.test.mjs`, `tests-js/team-detail-routes.test.mjs` (fixtures with `sourceSeasonCode` and the registry)
- `tests-js/astro-dist-contract.test.mjs` (the dist fixture: `writeRecommendedFixture` `:248-368`, `PRERENDERED_SECTION_BODY` `:159`, the allowlist test and the `FIXTURE_SITEMAP_ENTRIES` sitemap)
- `tests-js/seo-dist-contract.test.mjs`: the JSON-LD test at `:105-143` asserts exactly 2 JSON-LD blocks per team page and a 3-item breadcrumb `[home, family, url]`. Check `webPage.name` is a prefix of `<title>`, and that the description equals the meta description.
- `tests-js/analyze-state.test.mjs` (2): Soi đội keeps `?season=`.

**Dist/SEO** (`npm run test:dist`): `astro-dist-contract`, `seo-dist-contract`, `pages-headers-contract` (the first two need a built `dist`).

**E2E** (`npm run test:e2e` = `playwright test`; the config's webServer runs `npm run build && npm run preview` on port 4174):
- `tests-e2e/recommended-browser.spec.mjs`: 21 `?season=` lines, plus `getByLabel('Mùa')` at `:62,81,197,693,939,1069` and the URL assertion at `:84`.
- `tests-e2e/team-detail-pages.spec.mjs`: 14 lines (`:147,456-465,517-529,542,576,620-632,686-689,776`). H1 asserts at `:27` and `:52` use `toHaveText(row.displayNameVi || row.nameZh)`, an exact match.
- `tests-e2e/spa-parity.spec.mjs:319-320` (`/?season=s26#team-chuan` → `/doi-chuan/?season=s26`) and `:765-773` (Gợi ý đội, keep).
- `tests-e2e/team-ssr-adopt.spec.mjs:64` (`STALE_CASES`).
- `tests-e2e/unified-lookup.spec.mjs:546-551`.
- `tests-e2e/zh-locale.spec.mjs:138` (back-link regex `^\/zh\/doi-chuan\/(\?season=[^&]+)?$`).
- `tests-e2e/team-ssr-nojs.spec.mjs` (no-JS list, detail link regex `^${prefix}${path}[^/?#]+/`).
- Unchanged by this work: `beta-tools`, `a11y-targets` and `season-lookup.spec.mjs:555-577` (Gợi ý đội/Soi đội keep `?season=`; `season-lookup.spec.mjs:285` is the Cùng Tồn select, not Đội chuẩn).
- **About 51 of the e2e/node lines depend on `/doi-chuan/?season=`.** The e2e count is about 46: `recommended-browser` 21, `team-detail-pages` 14, `spa-parity` 2, `adopt` 1, `unified-lookup` 2, `zh-locale` 1, plus a few in `season-lookup` that are the Gợi ý đội cases. The Node count is about 30. These counts were pulled by `grep`, so treat them as approximate.

**Real verification commands:**
- `python3 -m pipeline.site_localization check --root . --stage public`
- `npm run build && npm run verify && npm run test:dist && npm run test:node`
- `npm run test:e2e` (or `npx playwright test <spec>`)
- `python3 -m pipeline.team_route_handles --check`
- `pages-deploy.yml:45-46` runs `npm run build` and `npm run verify`, so verifier drift breaks the production deploy.

## 4. TDD matrix (write failing first)

Season-page route inventory (`src/lib/season-pages.ts`):
- The slug is `og`/`pk-s28`/`s1` (`displayCode` lowercased), never the CJK `sourceSeasonId`. The same slug must equal the `routeSeasonSegment` prefix of every team slug in that season.
- Counts per slug equal the registry and index counts (25/93/130/…). Uncollected seasons (0 teams) must produce no sitemap entry and no page, or a `noindex` page. That policy needs a decision.
- A slug collision with a team `routeSegment` must be impossible. `/doi-chuan/mua/` plus a slug path never collides with `<code>-<handle>` team slugs.
- Do not add a `/doi-chuan/mua/` index page: `PAGE_KEY_PATTERN` (`js/community-api.js:11`) would accept `/doi-chuan/mua/` as a community page key.
- An empty fixture registry (as in `astro-dist-contract` `:268`) yields 0 season pages with no throw.

Season page content (SSR, no JS):
- Exactly one H1, with the season name and code.
- All N teams of the season are rendered (no 60 cap, or explicit pagination), each with a link `/doi-chuan/<seg>/?from=/doi-chuan/mua/<slug>/`.
- No "cần JavaScript" text. `data-ssr-source` equals `website.pin.sha256`.
- Canonical is its own URL. Hreflang vi/zh-Hans/x-default is present and consistent with the sitemap.
- JSON-LD includes the season name, a `CollectionPage`/`ItemList` whose items all have URLs of existing pages, `isPartOf` VideoGame, and a breadcrumb home › Đội chuẩn › season.
- vi and zh contain no other-language leakage (cf. `expectChineseOnly` in `zh-locale.spec.mjs`).
- Title and description are unique across season pages (the verifier's `claimHead` pattern). Note that S3 and PK-S7 share the same Vietnamese name, "Trận chiến Xích Bích", so the code must be in the title.

Team detail page:
- Title, H1 and JSON-LD `name` contain the season name. Update the exact H1 asserts at `team-detail-pages.spec.mjs:27,52`, or keep the H1 as the team name and put the season in the kicker. The issue says H1, so the choice must be explicit.
- The JSON-LD `name` must stay a prefix of `<title>`, and `description` must equal the meta description (`seo-dist-contract.test.mjs:123-124`).
- If the breadcrumb gains a season crumb, update the 3→4 item expectation.
- "Mùa cũ" label appears when `sourceSeasonId !== registry.defaultSourceSeasonId`. Test a non-default season (shows the label) and the default (does not), in vi ("mùa cũ") and zh.
- Changing `defaultSourceSeasonId` in a fixture flips the label with no client constant (`CURRENT_SOURCE_SEASON_ID` removed or derived).

Return link:
- A detail page opened from a season page returns to `/doi-chuan/mua/<slug>/` with `view`/`q` kept, in zh too (`/zh/…`). OG uses the `og` slug, not the CJK id.
- `safeReturnUrl('/doi-chuan/mua/pk-s24/?q=x')` is accepted and stripped to the allowed keys. Keys not allowed on that page are dropped.
- `familyReturnHref` with a season slug builds the season path; without a season it builds the plain section path.
- A hostile `from` (`//evil`, `\`, another origin, `..`) is still rejected.

Filter / dropdown:
- Choosing a season in the UI navigates to the season path with no `?season=` in the URL, and Back returns to the previous state.
- Season options are real `<a href>` links in the no-JS HTML (the issue's "Các mùa khác").
- `?season=all&q=…` (Tra cứu link) still works as the cross-season search, or its replacement is tested.
- `?season=pk-s24` redirects to `/doi-chuan/mua/pk-s24/` (the old URL has no stale-guard flash).
- Test `?season=` with unknown values (`s26`, `junk`), `all`, `unknown`, a repeated param, and `?season=pk-s24&q=x&view=bang` (the other params must be preserved).
- `/?season=pk-s24#team-chuan` ends at the season path (two hops).

Sitemap and verifier:
- The sitemap contains every collected season × (vi, zh), with hreflang pairs.
- The verifier fails when a season page file is missing or unexpected. It must tolerate the fixture with 0 seasons.
- `dist allowlist mismatch` appears if the season pages are not added to `expectedFiles` (`verify-astro-dist.mjs:268-285`).
- The sitemap byte-equality check still passes when the season paths are added to both `sitemap.xml.ts` and the verifier.

Don't-break tests:
- Soi đội and Gợi ý đội keep `?season=` (`analyze-state` tests, `season-lookup.spec.mjs:555-577`, `beta-tools.spec.mjs:1210`, `spa-parity.spec.mjs:765-773`).
- `?scenario=`/`?ruleset=`/`?config=` on `/doi-chuan/` still behave as before (`recommended-browser.spec.mjs:451`).

## 5. Risks and traps
1. **Đội khác has no season data**: either `/doi-khac/mua/*` pages are all empty or the model does not apply. Needs a decision. The "unknown"/"all" options exist only because of that.
2. **Return-link allowlist**: `SECTION_QUERY_KEYS` (`js/team-detail-navigation.js:25-35`, pinned) rejects any path it does not know. Every piece of return logic (snapshot, `upgradeReturnLink`, `captureReturnSnapshot`, `ssrStaleGuardScript`) is keyed on it.
3. **Pinned-file churn**: the files in the pin list include 12+ JS/Astro files that this change must touch. A `build`/`verify` failure means the main branch cannot deploy until the whole publish chain is re-run. The brief's serial lane already accounts for this.
4. **MCP re-release risk**: avoid `js/season-context.js`, `js/i18n.js` and `js/website-display.js`. Put new logic in `src/lib/season-pages.ts` and the pinned section files instead.
5. **Client H1 flip**: the client header replaces the SSR header on boot (`team-filter-section.js:279`), so a season H1 rendered only by SSR would flip. The adopt signature (`:159`) also includes `state.season`.
6. **`CURRENT_SOURCE_SEASON_ID`** is hardcoded (`team-filter-section.js:165`). The "Hiện tại" chip and the "mùa cũ" label must share one registry-derived source.
7. **Duplicate-content decision**: `/doi-chuan/` (default OG) and `/doi-chuan/mua/og/` hold the same content. The canonical policy needs a decision (self-canonical vs canonical to `/doi-chuan/`).
8. **Title uniqueness**: the verifier forbids duplicate `<title>`/description across detail pages (`verify-astro-dist.mjs:549-553`). If the season name goes into the title, check the duplicate names (S3 and PK-S7).
9. **`PAGE_KEY_PATTERN`** in `js/community-api.js:11` (and the worker side, `[UNVERIFIED]`) accepts any single segment under `/doi-chuan/`. Season pages sit under `/doi-chuan/mua/<slug>/` (two segments), but a `/doi-chuan/mua/` index page would match it.
10. **`?season=` legacy query**: a `_redirects` rule cannot match it. The old `s26` id does not exist, so redirect behaviour for invalid values must be specified.
11. **PK-S19 count**: advertised 88 versus 84 rows. This is pre-existing; do not make the season page assert the advertised count.
12. **Landing** links `…/doi-chuan/?view=bang` (`Landing.astro:314`). The `view` param is unaffected.
13. **llms**: `src/lib/llms-documents.ts` per-season files are independent of season pages. Linking them from the season pages is optional.

## 6. Missed or unclear in the brief and the issue
- The brief says Đội khác "sử dụng cùng mô hình"; the data says no (trap 1).
- The issue says "Bộ lọc mùa … không dùng `?season=`" but also needs a path for the Tra cứu cross-season link (`season=all&q=`) and for `?scenario=`/`?ruleset=` filters on the section pages. These remain query params.
- "Mùa PK cần phân trang hoặc nhóm theo loại binh/phe": the per-season maximum is 130, so one page per season is enough and no pagination is required.
- The issue does not say what to do with the 3 uncollected seasons (no pages vs. noindex pages).
- Whether `/doi-chuan/` should list season links to all 26 collected seasons (the issue says "Các mùa khác" as real `<a>` links) is implied but not specified for Đội khác.
- Whether the policy requires new `routeFamilies`/`sections` entries for new season pages: **[UNVERIFIED]**.