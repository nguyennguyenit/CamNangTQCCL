The plan fails its main success criterion for real clients. With the Phase 2 projection, the 238-item roster goes over the 40,000-character result limit whenever names are resolved server-side. That is how tqccl-auto and the coexist skill actually call normalize.

**How I measured:** I wrote a throwaway script outside the repo and have since deleted it. It runs `normalizeObservations` against the real `data/` snapshot, gets `familyId` the same way `withHeroFamilies` does, and applies the Phase 2 projection. My `workflowVersion` was the short stub `workflow:x:y`, so real results are about 200 B larger than the numbers below. Every size I give is therefore a lower bound. I did not run the project's lint, build or tests.

## Finding 1: The size baseline leaves out fields Phase 2 keeps, and the real limit is 40,000 characters
- **Severity:** Critical
- **Location:** Phase 2, "Design"; `research/size-measurement.md` (Compact A row and Conclusion); Phase 3, "Key Insights" ("~310 mục")
- **Flaw:**
  - The 32,517 B "Compact A" figure equals canonicalState 17,802 + observations 14,463. The research row for observations says "chỉ `observationId` + `canonicalId`", so it has no `entityKind`, but the Phase 2 Design keeps `entityKind`.
  - The fixture has no `displayName`, so all names came out empty in the measurement.
  - `enforceResultSize` also rejects `text.length >= 40_000`. The compact output is almost all ASCII IDs, so characters ≈ bytes, and 40,000 characters is a tighter limit than 43,008 bytes.
- **Failure scenario:** Measured with the Phase 2 Design applied:

| Case | Bytes | Chars | Result |
|---|---:|---:|---|
| Fixture as planned (IDs given, names empty) | 37,851 | 37,851 | passes, 2,149 chars to spare (plan says ~10 KB) |
| Same, names filled in (any #166 fix) | 42,100 | 41,038 | `RESULT_TOO_LARGE` |
| tqccl-auto path: names resolved by server, 22 ambiguous picked by canonicalId | 41,848 | 40,845 | `RESULT_TOO_LARGE` |
| tqccl-auto path, first pass, 22 unresolved | 47,043 | — | `RESULT_TOO_LARGE` |

  The CLI goes through `handlers.call` (`cli.ts:~192`), so tqccl-auto hits the same check. The Phase 1–3 tests pass on the fixture while Phase 4's real end-to-end run fails.
- **Evidence:**
  - `tool-context.ts:122`: `byteLength > MAX_RESULT_BYTES || text.length >= MAX_STRUCTURED_CHARS`.
  - `research-handlers.ts:97` sets `displayName: observation.displayName ?? known.get(canonicalId)` on the name path. `normalize-tool.test.ts:84` expects `displayName` "Vương Dị".
  - `advise.py:114-121` sends `observedText` unless a pick exists.
  - `SKILL.md:20`: "observation with `entityKind` and `observedText`".
  - Plan: "Compact A ... **32 517** dưới 42 KiB ... còn ~10 KB dư; ngoại suy tuyến tính trần kết quả ~310 mục".
- **Suggested fix:**
  - Measure the real handler path: names only, with the real `workflowVersion`, names filled in, and the first pass with unresolved items.
  - Drop `entityKind` from resolved observations. The `h`/`t` id prefixes and the canonicalId namespace already carry it.
  - Remove the duplication in Finding 3.
  - Set the limits from the 40,000-character check, not from bytes.
  - Add the name-only fixture to the Phase 1 tests.

## Finding 2: Phase 3's worst-case test can't reach the output step, and its fallback contradicts the 238 target
- **Severity:** High
- **Location:** Phase 3, "Decisions" and "Tests Before" #2
- **Flaw:** The plan treats `max(300)` and the 60 KiB request limit as compatible. Test #2 sends "300 observation với observedText/displayName dài nhất", but that request is over 60 KiB. The fallback "hạ trần số mục tới mức xanh" ends up below 238.
- **Failure scenario:**
  - 300 longest catalog names (120 heroes, 180 tactics): request is 63,456 B without `displayName` and 74,888 B with it. Both exceed 61,440, so validation returns `INVALID_REQUEST` and no output is ever measured.
  - If the test is shrunk to fit, output density is about 159–176 chars per item, which caps out at roughly 227–251 items. With names filled in, the honest limit is below 238.
  - Following the plan's own rule therefore breaks the success criterion "Fixture kho thật 238 mục".
- **Evidence:**
  - `shared-schemas.ts:134-155`: `boundedRequest` checks the byte length of the parsed value.
  - Long-name output: 49,333 chars without names, 54,083 chars with names.
- **Suggested fix:**
  - Choose the observation cap and the request-byte cap together, from real measurements.
  - Write the worst case as the largest request that still passes validation, not "300 longest names".
  - Decide now what happens if the cap must drop below 238 (pagination is currently out of scope).

## Finding 3: The claim that `unresolved` has no `observedText` is false, so ambiguous data is sent twice
- **Severity:** High
- **Location:** Phase 2, "Key Insights" bullet 3 and "Design" (`observations[]` rule)
- **Flaw:**
  - The plan keeps `observedText` and `candidates` on compact observations because it claims `unresolved` lacks `observedText`.
  - In fact every unresolved item from `unresolvedObservation` already carries `observedText`, `candidates`, `reason` and the full `evidence` object, and the plan keeps `unresolved` unchanged.
  - The rule "only when `reviewRequired`" also drops candidates for unknown names. `withResolvedNames` returns `{...observation, candidates}` without `reviewRequired` (`research-handlers.ts:82-85`). The data survives only because `unresolved` duplicates it.
- **Failure scenario:** On the first normalize pass, the step where the user reviews ambiguities, each ambiguous item is sent twice with full evidence. <tài khoản>'s 22 ambiguous names give 47,043 B, so the review screen fails with `RESULT_TOO_LARGE`.
- **Evidence:**
  - `normalization-service.ts:300-313`: `observedText: sanitizeLabel(observation.observedText), candidates: [...], reason: ..., evidence: {...}`.
  - The plan cites `:562-597`, which covers only the synthetic conflict entries.
  - The digest uses only `unresolved.length` (`canonical-state.ts:169`).
- **Suggested fix:**
  - Make `canonicalState.unresolved` the single source for review data.
  - Remove `evidence` from unresolved items; this does not affect the digest.
  - Reduce observations to `observationId`, `canonicalId?` and `reviewRequired?`.
  - tqccl-auto `summary()` reads only `observationId`, `entityKind`, `reason`, `candidates` and `observedText` from unresolved (`advise.py:204-206`).

## Finding 4: The fixture and digest pin depend on catalog names, and Phase 1 test 1 cannot run as written
- **Severity:** High
- **Location:** Phase 1, "Files to Create / Modify", "Tests Before" #1, and "Risk Assessment"
- **Flaw:**
  - The risk section says "fixture gửi sẵn canonicalId nên ổn định". But both `canonicalId` and `familyId` are slugs of the catalog display name (`hero-identity.js:37-45`).
  - The handler rejects any `canonicalId` that is missing from the snapshot (`research-handlers.ts:112-116`) and builds `familyId` from snapshot names (`:118`).
  - Separately, the fixture is specified as "chỉ `observedText`, `canonicalId`, `redStars`", with no `familyId`. The domain function `canonicalHero` then throws "needs a hero family ID", so test 1 cannot run as written.
- **Failure scenario:**
  - Any rename in `data/heroes-dict.json` or `data/tactics.json` changes or removes IDs. There were 25 commits to those files since 2026-08-19, including "sửa ... tên Tra cứu" (c3dfd222). Issue #164, the Hán-Việt name fix and the next item in line, is exactly such a rename.
  - When that happens, Phase 1 tests 4–6 and Phase 3 #3 return `INVALID_REQUEST` (`observations[i].canonicalId`), and the pinned digest changes. These unrelated data PRs then fail the normalize tests.
- **Evidence:**
  - `normalization-service.ts`, `canonicalHero`: `if (!familyId.startsWith("hero-family:")) throw new TypeError(...)`.
  - `real-handlers.ts:9` uses the repository `data/` root.
  - I reproduced the pinned `qRtX…` digest only after adding `familyId` derived from catalog names.
- **Suggested fix:**
  - State that `familyId` must be derived the way `withHeroFamilies` does it.
  - Build the fixture IDs from the snapshot when the test runs, or store a frozen snapshot with the fixture.
  - Pin the digest's invariance (handler digest = domain digest for the same input), not a literal hash tied to live data.

## Finding 5: The planned HTTP test uses a stub snapshot that contains none of the 238 IDs
- **Severity:** Medium
- **Location:** Phase 3, "Tests Before" #5
- **Flaw:** "request normalize 238 mục qua `worker.integration` (workerd)". `worker.integration.test.ts` runs in Node, not workerd. Its data source is `test/fixtures/release-snapshot`, whose `heroes-dict.json` has a single entry, "Tướng A".
- **Failure scenario:** All 93 real hero IDs fail the `withHeroFamilies` lookup, so the test can never return 200. Either it gets rewritten ad hoc or it gets weakened.
- **Evidence:**
  - `worker.integration.test.ts:16-18,66` (`dataRoot: fixtureRoot`).
  - `test/fixtures/release-snapshot/heroes-dict.json` (7 lines, one hero).
  - The real-data workerd setup is `vitest.worker-production.config.ts:14-18` (`dataRoot: resolve("../data")`), used by `worker-budget.workerd.test.ts:59`.
- **Suggested fix:** Put the 238-item HTTP case under `vitest.worker-production.config.ts`, next to the worker-budget test. Add it to the Phase 3 gate as `test:worker` with the production config.

## Finding 6: A request under 60 KiB can still be rejected at the HTTP layer with 413
- **Severity:** Medium
- **Location:** Phase 3, "Decisions" ("60 KiB (61 440) để lọt body HTTP 64 KiB kèm envelope") and "Risk Assessment"
- **Flaw:**
  - `boundedRequest` measures `JSON.stringify` of the parsed arguments.
  - The HTTP limit measures the raw body: JSON-RPC envelope, the client's whitespace and the client's escaping.
  - That leaves only 4,096 B of margin.
- **Failure scenario:**
  - ASCII-escaping the fixture adds 5.5% (47,115 → 49,696 B). At 61,440 B that gives about 64.8 KB plus the envelope, right at the limit.
  - Clients that add separator spaces (Python's `json.dumps` default) or pretty-print go over it. The pretty-printed 238 request is already 76,233 B.
  - These clients get transport-level `413 BODY_TOO_LARGE` from `request-guards.ts:132-135`, not the `INVALID_REQUEST` the plan promises for oversized rosters.
  - Test #5 uses only about 47 KB, so nothing tests behaviour near the limit.
- **Evidence:** `wrangler.jsonc:26` (`"65536"`), `worker.ts:291-294`, `request-guards.ts:81-83,132-135`.
- **Suggested fix:**
  - Leave margin for escaping (about 1.07 × cap + envelope ≤ 65,536), or document that clients must send compact UTF-8.
  - Add a workerd test at exactly the request-byte cap, sent with ASCII escapes.

## Finding 7: Tripling the input cap without checking output warning limits risks `INTERNAL_ERROR`
- **Severity:** Medium
- **Location:** Phase 3, "Decisions" (`observations.max(300)`)
- **Flaw:**
  - Output and recommend schemas cap `warnings` at 100: `shared-schemas.ts:356-360` (canonicalState) and `:411-414` (common result).
  - The domain adds one warning for each conflicting `redStars` or `level` per hero (`normalization-service.ts:107-110`) and for each conflicting identity (`:561`).
  - `handleNormalize` spreads `normalized.warnings` into the top-level `warnings`.
- **Failure scenario:**
  - With 300 observations from image scans, about 150 heroes each seen twice with OCR-different `redStars` and `level` can produce up to 300 warnings.
  - Output parsing then fails, and `execute` turns it into an opaque `INTERNAL_ERROR` (`research-handlers.ts:184-188`).
  - At 100 observations the worst case was about 100 warnings, inside the cap.
- **Evidence:** as cited above. No phase re-derives output collection bounds after raising the input cap.
- **Suggested fix:** Add a Phase 3 test with the maximum number of conflicts. Then either raise the warnings caps in step with the input cap, or collapse warnings into per-kind counts.

## Finding 8: The success test for normalize → recommend can pass while proving nothing
- **Severity:** Medium
- **Location:** Phase 1, "Tests Before" #6; Plan, "Success Criteria" #1
- **Flaw:** The test only asserts "không lỗi". The fixture has no `displayName`, and the handler adds none when `canonicalId` is given, so all 238 state entries carry `displayName: ""`. `recommend` uses `displayName` as the owned hero/tactic `name` (`recommend-handlers.ts:286-307`) and returns it in its output.
- **Failure scenario:** The fixture run has no names (all 93 heroes `dispEmpty` in my measurement), so it is not the payload real clients produce. The size and character margins it proves (Finding 1) do not carry over. The real tqccl-auto `summary()` (`advise.py:214-215`) and Phase 4's `recommend --full-box` run use filled names. The run that matters is only tried at the manual end-to-end step.
- **Evidence:** Phase 1 fixture spec "chỉ `observedText`, `canonicalId`, `redStars`"; `research-handlers.ts:97` (names are filled only on the lookup path).
- **Suggested fix:** Use a name-only (or name-filled) variant of the fixture in tests 4–6. Assert that `heroes[].displayName` is non-empty and that recommend actually used the roster, not just that it returned without error.

## Verification Results

**Contract Verifier: who reads the normalize output**
- Writes it: `research-handlers.ts:143-147`.
- Reads it:
  - `scripts/verify-release.ts:406-420,469-491` (`reviewRequired`, `canonicalState.heroes[].canonicalId`, binding).
  - `scripts/verify-release.ts:107-135`: byte-for-byte `outputSchema` comparison against live `tools/list`. The release redeploy must ship together.
  - `test/domain/normalization-service.test.ts:304`: domain level, not affected.
  - `test/research/normalize-tool.test.ts:17,79,84` (`canonicalState` `familyId`/`displayName`: kept).
  - `test/cli.integration.test.ts:188-196`, `test/transport/all-tools-parity.test.ts:124-132`, `test/transport/season-tools-parity.test.ts:39-42`, `test/research/season-research.test.ts:14`, `test/performance/worker-budget.workerd.test.ts:59-85`, `test/mcp/registry.contract.test.ts:269,546-550`.
  - `tqccl-auto/tqkh/advise.py:191-194,204-216,246`.
  - `.agents/skills/tqccl-coexist-team-builder/SKILL.md:20,34`.
- CLI parser: `parseCliArgs` is synchronous and is called directly at `cli.integration.test.ts:62-80`. Reading a file or stdin needs I/O, so its signature or call sites must change.
- Workflow build: new `src/` modules would also have to be added to `workflow-source-manifest.json`. `generate-workflow-build.ts:160-163` requires that list to exactly match the import graph.

**Fact Checker:** 31 claims checked: 24 verified, 7 failed, 4 left unverified.
- **Verified:** `tool-context.ts:118-126`; `research-handlers.ts:128-148,182`; `format-result.ts` duplicates the JSON; `wrangler.jsonc:26-27`; `canonical-state.ts:165-198` and `canonical-state.test.ts:59`; digest `qRtX…` (reproduced with catalog-derived `familyId`; the digest does not depend on `workflowVersion`); `advise.py:188-196`; `recommend-handlers.ts:286-307`; `shared-schemas.ts:262-299`; `research-contracts.ts:15-18` and `:26` (actually line 27); `shared-schemas.ts:5-6`; `normalization-service.test.ts:304,699-714`; `research-handlers.test.ts:110-126,129-147`; `registry.contract.test.ts:546-550,269`; input 238 = 47,115 B; `cli.ts:61-95,114`; `worker-budget.workerd.test.ts` exists; `goclaw-mcp-skill-handoff.md:39` (131072); `SKILL.md:20,34`; a compact state keeps `displayName`/`familyId` as recommend requires; digest unchanged by compaction (the projection omits the dropped fields).
- **Failed:**
  1. "`unresolved` không có `observedText`" (`normalization-service.ts:562-597`); see `:300-313`.
  2. Compact A = 32,517 B for the planned design: that figure leaves out `entityKind`; the design measures 37,851 B.
  3. "~310 mục dưới 42 KiB": the 40,000-char limit binds, and real name-filled 238 is already over it.
  4. The Phase 3 worst-case 300-item request fits in 60 KiB: it is 63,456–74,888 B.
  5. `worker.integration` can run 238 real items: it uses a one-hero stub snapshot.
  6. "fixture gửi sẵn canonicalId nên ổn định": IDs and `familyId` depend on catalog names.
  7. Phase 1 test 1 runs with the planned fixture fields: the domain needs `familyId`.
- **Unverified:** "41 740 B tại ~75 observation"; Windows 32,767 / tqccl-auto 30,000 limits beyond `advise.py:21`; `agent-knowledge/workflows.json:105-141` content; consumers outside both repos (Dewee/GoClaw).

Status: DONE_WITH_CONCERNS
Summary: The plan's size baseline is wrong. The realistic 238-item name-resolved roster gives 40,845–47,043 chars/bytes and hits `RESULT_TOO_LARGE` under the planned design, and the 300 / 60 KiB limits conflict with each other. Digest invariance under compaction holds.
Concerns/Blockers: Findings 1–2 block the main success criterion. Sizes must be re-measured on the real name-lookup path and the limits set from the 40,000-character rule before Phase 2 starts.