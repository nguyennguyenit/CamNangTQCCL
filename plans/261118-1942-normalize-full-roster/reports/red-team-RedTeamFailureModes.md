I found 10 problems in the plan. Two of them block success: the size budget was measured on a smaller output than Phase 2 would produce, and a factual claim in Phase 2 about `unresolved` is wrong.

## Finding 1: The 238-item size budget was measured on the wrong output shape, so real callers will still get `RESULT_TOO_LARGE`
- **Severity:** Critical
- **Location:** Phase 2 "Design"; Phase 3 "Key Insights" / "Tests Before #2"; `research/size-measurement.md`
- **Flaw:** Compact A (32 517 B) was measured with observations holding only `observationId` + `canonicalId` (`size-measurement.md:11`). It was also measured with `canonicalState.heroes/tactics[].displayName` empty, because the fixture sends `canonicalId`, which skips name lookup (`research-handlers.ts:59`). Phase 2 adds `entityKind` to every observation (`phase-02:26`). Real callers send `observedText`. For them, `withResolvedNames` fills `displayName` with the catalog name (`research-handlers.ts:97`), and `canonicalHero` copies it into state (`normalization-service.ts:144`). The "~310 items" extrapolation rests on the wrong shape.
- **Failure scenario:** I ran a throwaway script on the 238-item fixture, calling `normalizeObservations` with Phase 2's projection. The temp file is deleted; no repo files were touched.

  | Variant | Size |
  |---|---|
  | Plan's shape | 32 508 B (matches the plan's figure) |
  | + `entityKind` | 37 558 B |
  | + catalog `displayName` | 41 800 B / 40 736 chars |
  | + 13 ambiguous base-name heroes | 44 719 B |

  - The `displayName` variant is already ≥ `MAX_STRUCTURED_CHARS` 40 000 (`tool-context.ts:12,123`) before the `commonResult` fields are added (`tool-context.ts:70-77`).
  - The ambiguous variant is over the 43 008 B limit.
  - `advise.py:118-120` sends `observedText` for every item the user hasn't picked. The coexist skill tells agents to send `observedText` for every item (`SKILL.md:20`).
  - Result: all Phase 1–3 tests pass on the `canonicalId` fixture, while the real E2E and Dewee hit `RESULT_TOO_LARGE`.
  - Phase 3 test #2's fallback ("lower the item cap until green") would land below 238, which contradicts the plan's own success criterion.
  - Fixing #166 (empty `displayName`) would also re-break #165 on the `canonicalId` path.
- **Evidence:** `size-measurement.md:11-12`; `phase-02:26` "`observationId`, `entityKind`, `canonicalId?`"; `phase-03:18` "ngoại suy tối đa ~310 mục"; `research-handlers.ts:97`; `normalization-service.ts:144`; `tool-context.ts:12,121-124`.
- **Suggested fix:**
  - Re-measure the exact Phase 2 projection, including `commonResult`, on an `observedText` variant of the fixture plus an ambiguous-heavy variant.
  - Add both variants to Phase 1 tests #4–5.
  - Trim further where it is safe: drop `entityKind` (the id prefix already gives it), and drop `evidence` from `unresolved` (see Finding 2).
  - Then pick the cap from measured numbers.

## Finding 2: Phase 2's claim that `unresolved` has no `observedText` is false, which leads to duplicated, oversized ambiguous items
- **Severity:** High
- **Location:** Phase 2, "Key Insights" bullet 3 and "Design" (`unresolved` … giữ nguyên)
- **Flaw:** The plan says `canonicalState.unresolved` lacks `observedText` (it cites `normalization-service.ts:562-597`). Those lines are only the conflict entries. The main `unresolved` list is built by `.map(unresolvedObservation)` (`:557-559`). That function emits `observedText`, `candidates` and a full `evidence` object (`:300-313`). Phase 2 keeps `unresolved` unchanged and also copies `observedText` + `candidates` into the compact observations.
- **Failure scenario:** The first normalize of a new roster, before any picks, has the most base-name ambiguities. Each one costs about 262 B in `unresolved` (3 403 B for 13 items in my run), plus the duplicated compact observation. This is the payload most likely to go over the limit, and it is the one users see first.
- **Evidence:** `normalization-service.ts:300-313,557-559`; `phase-02:18`.
- **Suggested fix:** Correct the insight. Strip `evidence` from `unresolved`; the digest only uses `unresolved.length` (`canonical-state.ts:169`). Don't duplicate `observedText` and `candidates` in observations. `advise.py:204` already reads `u.get("observedText")` from `unresolved`.

## Finding 3: Auto-deploy on merge breaks Dewee sessions that cached the old output schema; the only mitigation is a note in the PR description
- **Severity:** High
- **Location:** Phase 4 "Risk Assessment" bullet 2; Phase 2 "Risk Assessment"
- **Flaw:** Any merge touching `mcp-worker/**` deploys to production automatically (`mcp-release.yml:12-19`). The currently published observation item schema is strict and requires `evidence` (`shared-schemas.ts:220-259`). `publishedOutputSchema` only makes top-level fields optional (`research-contracts.ts:109-114`). The MCP SDK client caches output validators from `tools/list` and rejects non-matching `structuredContent` (`sdk/dist/esm/client/index.js:486-498,528-536`).
- **Failure scenario:** Merge, then deploy within about 5 minutes. Any Dewee session that has not reconnected then fails every normalize with "Structured content does not match the tool's output schema", on top of all confirmed bindings becoming invalid. I am inferring that Dewee uses a validating SDK client; I did not check Dewee's code. Nobody owns doing the refresh, and there is no time window agreed with the Dewee owner. The handoff doc still says "chưa deploy" (`goclaw-mcp-skill-handoff.md:76`).
- **Evidence:** `phase-04:47` "Dewee phải refresh `tools/list` … Ghi vào PR description".
- **Suggested fix:**
  - Agree a merge window with the Dewee owner.
  - After deploy, run a step that reconnects Dewee and smoke-tests normalize.
  - Put the breaking-change notice into `docs/goclaw-mcp-skill-handoff.md`, not only the PR.

## Finding 4: The plan has no rollback section; rollback rehearsal fails for this release, and a rollback breaks clients again
- **Severity:** High
- **Location:** `plan.md` and all phases (no rollback section)
- **Flaw:**
  - `readReleaseIdentity` checks the *prior* version's `tools/list` against the *candidate's* `TOOL_DEFINITIONS` (`verify-release.ts:185-188`, `matchesExpectedToolCatalog`). It runs in `prepareRollbackVerification` (`release-worker-version.ts:150-165`) before smoke (`worker-deployment-controller.ts:258-259`).
  - A manual rollback (`goclaw-mcp-skill-handoff.md:78`) brings back `max(100)`/16 KiB and the old `WORKFLOW_BUILD_ID`.
- **Failure scenario:**
  - `rehearse_rollback=true` aborts at `rollback-prior:catalog`, because the normalize schema differs.
  - A production rollback invalidates bindings a second time.
  - Clients that refreshed to the new strict compact schema reject the old full-shape output (extra `evidence`/`displayName`/`familyId` violate `additionalProperties:false`).
  - A `git revert` of CamNangTQCCL leaves tqccl-auto calling `--input-file`, which produces `CLI_USAGE` (`cli.ts:93`).
- **Evidence:** `verify-release.ts:185-188`; `release-worker-version.ts:150-165`; `worker-deployment-controller.ts:258`.
- **Suggested fix:** Add a rollback section:
  - Don't use `rehearse_rollback` for this release.
  - Revert tqccl-auto before CamNangTQCCL.
  - Require clients to re-list tools after a rollback.
  - Note the second binding invalidation in the changelog.

## Finding 5: The cross-repo ordering targets the wrong thing (a live working tree, not "merged main"), and the E2E runs only after production deploy
- **Severity:** High
- **Location:** Phase 4, "Risk Assessment" bullet 1 and "Tasks & Steps" step 3
- **Flaw:** tqccl-auto runs the CLI from whatever is checked out under `khaihoang_path` (`advise.py:32-37`). All four accounts point at this dev working tree (`tqccl-auto/state/<4 account>/config.json:14`). "Merge CamNangTQCCL first" doesn't control that; the current `git checkout` does. There is no capability check, and an old CLI returns the opaque `camnang:CLI_USAGE` ("Tham số CLI không hợp lệ", `cli.ts:159-168` → `advise.py:58-62`).
- **Failure scenario:**
  - The developer checks out any branch based on pre-merge main (hotfix, review). All four accounts' `advise` breaks with no actionable message.
  - The E2E (which needs the user to confirm) only happens after merge, which means after the production deploy. A failure such as Finding 1 is found in production.
  - If the user is unavailable, Phase 4's success criterion cannot be met, and the plan has no stop or waiver path.
- **Evidence:** `phase-04:46` "merge CamNangTQCCL trước, rồi tqccl-auto"; `phase-04:35`.
- **Suggested fix:**
  - Run the E2E against the feature branch before opening or merging the PR.
  - In `advise.call()`, fall back to `--input` when the payload is ≤ 30 000 chars, or detect `--input-file` via `--help` and raise a clear `camnang_outdated` error.
  - State what happens if the user's confirmation isn't available.

## Finding 6: Phase 3 test #5 cannot pass where the plan puts it
- **Severity:** High
- **Location:** Phase 3, "Tests Before" #5
- **Flaw:** `worker.integration.test.ts` is a Node test, not workerd. `vitest.worker.config.ts` only includes `*.workerd.test.ts`. It loads `test/fixtures/release-snapshot`: `heroes-dict.json` is 95 bytes with 1 entry, `tactics.json` has 2, and the manifest is `schemaVersion: 1`. `withHeroFamilies` throws `INVALID_REQUEST` for any hero `canonicalId` missing from the snapshot (`research-handlers.ts:112-116`).
- **Failure scenario:** The 238-item fixture is rejected at `observations[0..].canonicalId`. The implementer then either drops the test or swaps the fixture, so no test proves the HTTP 64 KiB body cap with the real request.
- **Evidence:** `phase-03:36` "qua `worker.integration` (workerd)"; `worker.integration.test.ts:16-17,27-28`; `vitest.worker.config.ts` include list.
- **Suggested fix:** Put this case in `test/performance/*.workerd.test.ts`, which uses the production corpus (`vitest.worker-production.config.ts:37`). Assert on raw request bytes including the JSON-RPC envelope.

## Finding 7: The Worker budget check the plan relies on doesn't measure normalize or the full-roster recommend
- **Severity:** Medium
- **Location:** Phase 3, "Risk Assessment" bullet 1
- **Flaw:**
  - `worker-budget.workerd.test.ts:59-99` records only cold, warm and recommendation times. Normalize is never timed.
  - It sends `canonicalId`, which bypasses the expensive path: one `searchCatalog(limit:100)` per observation, plus a `similarCatalog` fallback (`research-handlers.ts:74-85`).
  - A 93-hero / 145-tactic state turns on `fullBox` automatically (`recommend-handlers.ts:326`), the heaviest search. The existing 1 000 ms limit was measured on a 3-hero team.
- **Failure scenario:** The plan says to "add a 238-item case; stop if over budget". There is no normalize budget to go over, so the case passes regardless of time. CPU regressions on Dewee's real `observedText` + full-roster path ship unseen.
- **Evidence:** `phase-03:48`; `worker-budget.workerd.test.ts:88-99`.
- **Suggested fix:** Add `normalizeMs` (with `observedText` inputs) and full-roster `recommendationMs` metrics with explicit limits, both in the production workerd config.

## Finding 8: The `it.fails` approach can't record the expected error and can be left in place unnoticed
- **Severity:** Medium
- **Location:** Phase 1, "Tests Before (phải ĐỎ)" and "Success Criteria"; Phase 2 "Tests Before" #6
- **Flaw:**
  - `it.fails` passes on *any* throw. "Đỏ đúng lý do (ghi lỗi mong đợi trong test)" contradicts that: asserting `INVALID_REQUEST` makes the body pass, so `it.fails` reports a failure.
  - Written as success assertions, tests #4–6 are also "red" for a wrong fixture path, a `TypeError`, or a missing `familyId`. Domain heroes need `familyId` (`normalization-service.ts:136-138`), and the fixture spec omits it (`phase-01:22`).
  - Phase 2 #6 says "phase 1 #5 green at 100 items", but #5 uses 238 items.
  - No gate checks that the markers were removed.
- **Failure scenario:** Phase 3 lands only partly. The markers stay, CI is green, and the 238-item path is still unproven.
- **Evidence:** `phase-01:30,44`; `phase-02:42`.
- **Suggested fix:**
  - Write tests #4–6 as current-behavior assertions (`INVALID_REQUEST` with `fields`) and flip them in Phase 3.
  - Add a Phase 3/4 gate: `rg "it\.fails" test/research/normalize-full-roster.test.ts` must be empty.
  - Include `familyId` in the fixture.

## Finding 9: The 300-item cap and the 60 KiB byte cap disagree, and the first one hit gives an unhelpful error
- **Severity:** Medium
- **Location:** Phase 3 "Decisions"; Phase 4 tqccl-auto `MAX_OBSERVATIONS = 300`
- **Flaw:**
  - By the plan's own figures, 47 115 B / 238 items ≈ 198 B per item, so 300 items ≈ 59.4 KB, about 2 KB under 61 440.
  - The advise payload carries `evidence` with a per-account `batchId` on every item (`advise.py:115`).
  - The second normalize call adds locked-team observations with `heroIds`/`tacticIds` (`advise.py:155-157,194-196`), which count toward the 300 (`advise.py:182`).
- **Failure scenario:** A user with about 280–300 items plus locks passes advise's 300-item pre-check. The server then rejects with a generic byte-limit `INVALID_REQUEST` (`shared-schemas.ts:138-147`), which surfaces as `camnang:INVALID_REQUEST`. That is not `roster_too_large`, so the `tu-van-team` skill has no recovery path.
- **Evidence:** `phase-03:22`; `size-measurement.md:15`.
- **Suggested fix:** Have advise pre-check serialized UTF-8 bytes ≤ 61 440 and raise `roster_too_large`. Alternatively, derive the count cap from worst-case bytes per item, including locked teams, and pin it in a test.

## Finding 10: Consumer list misses a second skill copy and the tqccl-auto tests; the temp-file handoff has unaddressed Windows pitfalls
- **Severity:** Medium
- **Location:** Phase 4, "Files to Create / Modify" (tqccl-auto)
- **Flaw:**
  - The plan updates only `~/.omp/agent/skills/tu-van-team/SKILL.md`. The versioned copy `tqccl-auto/skill/tu-van-team/SKILL.md:31,55` also says "Kho > 100 mục → roster_too_large", and the two files differ.
  - The affected tests are not named:
    - `tests/test_logic_advise.py:139-146` loops 101 items.
    - `:107` asserts evidence was stripped.
    - `:39,56` fake normalize output with full `evidence`/`confidence`.
  - "Write the payload to a temp file" gives no encoding or locking rules. On Windows, Python's default text encoding isn't UTF-8 and `NamedTemporaryFile(delete=True)` keeps the file locked against other processes. A BOM from `utf-8-sig` breaks `JSON.parse`.
- **Failure scenario:**
  - The repo copy of the skill keeps telling agents to ask users to cut items below 100.
  - Writing Vietnamese names can fail outright on the Windows default encoding (charmap encode error), or the CLI reports `CLI_USAGE` on BOM-prefixed or locked files.
- **Evidence:** `tqccl-auto/skill/tu-van-team/SKILL.md:31,55`; `tests/test_logic_advise.py:107,139-146`; `phase-04:24-26`.
- **Suggested fix:**
  - List both skill copies and the specific tests.
  - Specify `encoding="utf-8"` (no BOM), `delete=False` with cleanup in `finally`, and an absolute path.
  - Add a Windows test with a Vietnamese payload.

## Verification Results
- **Claims checked:** 41. **Verified:** 33. **Failed:** 5. **Unverified:** 3.
- **Verified:**
  - Config and limits: `wrangler.jsonc:26-27`; `tool-context.ts:11-12,118-126`; `shared-schemas.ts:6,262-299`; `research-contracts.ts:15-18,26`.
  - Handler and digest: `research-handlers.ts:128-148,182`; `canonical-state.ts:165-198`; `canonical-state.test.ts:59`; `recommend-handlers.ts:286-307` (no `evidence`/`confidence` read).
  - CLI: `cli.ts:61-95,114`.
  - External consumer: `advise.py:20-21,161-169,188-196`.
  - Tests: `normalization-service.test.ts:304,699-714`; `research-handlers.test.ts:129-147`; `registry.contract.test.ts:269,546-550`.
  - Docs and skills: `mcp-research-server.md:17`; `goclaw-mcp-skill-handoff.md:39` (131072), `:45-50`, `:75`, `:77`; `SKILL.md:20,34`.
  - Scripts and CI: npm scripts `generate:`/`check:workflow-build`, `check:knowledge-bundle`, `test:coverage`; `mcp-release.yml` push-to-main trigger.
- **Failed:**
  1. `phase-02:18`: "unresolved không có `observedText`". `unresolvedObservation` (`normalization-service.ts:300-313`) includes it, plus `evidence`.
  2. `phase-03:18`: "~310 mục dưới 42 KiB". The measured shape omits `entityKind` and has empty `displayName`; the Phase 2 shape with catalog names is 40 736 chars at 238 items.
  3. `phase-03:36`: "`worker.integration` (workerd)". It is a Node test, and its snapshot has 1 hero.
  4. `phase-03:48`: the Worker budget test can catch normalize overruns. It has no normalize metric.
  5. `phase-04:26`: the skill update list is complete. It misses `tqccl-auto/skill/tu-van-team/SKILL.md`.
- **Unverified:**
  1. The pinned digest `qRtX_…`. With `familyId` derived from fixture `observedText` I got `LZ65u9…`. The digest includes `familyId` (`canonical-state.ts:173`), which comes from snapshot names that the fixture lacks, so the "stable because canonicalId" claim at `phase-01:47` is weaker than stated.
  2. Whether Dewee validates against cached output schemas. I only checked the MCP SDK client behavior.
  3. The 14 T0.5 teams E2E criterion. It may also depend on #164, which is out of scope.

Status: DONE_WITH_CONCERNS
Summary: Ten findings. The critical ones are that the 238-item compact output goes over the 40 000-char limit once you include `entityKind` and the `displayName` values real callers produce, and that the plan's claim about `unresolved` is wrong. On rollout, the plan has no rollback section, the cross-repo order depends on a live working tree, and the HTTP and performance tests can't pass or measure nothing as written.
Concerns/Blockers: The size numbers come from a throwaway script I ran against the domain function; I did not run the real handler with `commonResult`. That would only make the result bigger.