## Finding 1: The size and CPU gates use canonicalIds, but real clients send plain names and take the slow lookup path
- **Severity:** High
- **Location:** Phase 1, "Files to Create / Modify" and "Tests Before" #4–#6; Phase 3, "Risk Assessment" (worker budget)
- **Flaw:** The Phase 1 fixture sends `canonicalId` on every item, which skips `withResolvedNames` entirely. Real clients send `observedText` (the name as typed). That path does a full scan of the catalog for each item (`searchCatalog`), and when nothing matches it runs `similarCatalog`, which scores and sorts against every entity of that kind. The Phase 3 budget check says "thêm ca 238 mục" in `worker-budget.workerd.test.ts`. That test never times normalize: it only asserts cold/warm playbook time and `recommendationMs < 1000`. The domain budget test (`domain-budget.test.ts`, 60 items, 2 s) is not mentioned at all. With 238 items, recommend also switches on `fullBox` by default (more than 40 heroes and more than 60 tactics) plus `metaSearch`. Phase 1 test #6 runs that path with no time limit.
- **Failure scenario:** Every gate passes on the canonicalId fixture. In production, `tqccl-auto` sends 215 of the 238 items as names (only 23 have stored picks). An authenticated MCP client can also send 300 made-up names in about 57 KB. Each request then runs about 600 full catalog scans before failing anyway (see Finding 2). With `TQCCL_MCP_MAX_IN_FLIGHT` at 4, a few such requests use up the Worker's CPU. None of this was measured.
- **Evidence:**
  - `mcp-worker/src/research/research-handlers.ts:56-61`: `needsLookup` requires `canonicalId === undefined`.
  - `research-handlers.ts:79-83`: `searchCatalog(name,{limit:100})`, then `similarCatalog(...)` on a miss.
  - `src/data/publication-projection.ts:902-916` and `:927-940`: both loop over the whole `searchIndex` / `tokenIndex`.
  - `../tqccl-auto/tqkh/advise.py:110-116` (`_obs` sends `observedText` unless a pick exists); `state/<account>/kho.json` has 23 picks.
  - `.agents/skills/tqccl-coexist-team-builder/SKILL.md:20`: "observation with `entityKind` and `observedText`".
  - `test/performance/worker-budget.workerd.test.ts:93-95`: the only assertions; no normalize time.
  - `src/research/recommend-handlers.ts:326`: `fullBox = ownedHeroes.length > 40 && ownedTactics.length > 60`.
  - Plan (Phase 1): "chỉ `observedText`, `canonicalId`, `redStars`".
- **Suggested fix:**
  - Add a second fixture with names only (no canonicalIds), shaped like `advise.py`.
  - Add a worst-case set of 300 unknown names under 60 KiB.
  - Time normalize and the 238-item `meta`/`fullBox` recommend in both `domain-budget.test.ts` and the workerd budget test, with explicit thresholds.
  - Do not raise the cap to 300 until those numbers exist.

## Finding 2: The worst-case size test leaves out `unresolved`, the one part that isn't compacted (and the plan's reason for keeping `observedText` is wrong)
- **Severity:** High
- **Location:** Phase 2, "Key Insights" bullet 3 and "Design"; Phase 3, "Tests Before" #2; `research/size-measurement.md`
- **Flaw:** Phase 2 says `canonicalState.unresolved` has no `observedText`. That is false. Every unknown or ambiguous item goes through `unresolvedObservation`, which outputs `observedText`, `candidates`, `reason`, `trust`, and the full `evidence` (`batchId`, `imageOrdinal`, `fieldPresence`, `trust`). Phase 2 keeps `unresolved` exactly as it is ("giữ nguyên"). It also copies `observedText` and `candidates` into the compact observation for review items, so each one appears twice. The 32,517 B measurement and the "~310 items" estimate come from a fixture where `unresolved` is empty. Phase 3's worst case uses only names that exist in the catalog. The current test with 300 unknown names (`research-handlers.test.ts:136-144`) is split into a 301-item case and a >60 KiB case, so nobody tests the size of an input that is all unresolved.
- **Failure scenario:**
  - **Realistic:** the 238-item roster sent as names, with roughly 60 Hán-Việt or misspelled names (issue #164 is exactly this). Each unresolved entry is about 300+ B with 5 suggested candidates. The total passes 43,008 B, so the call returns `RESULT_TOO_LARGE`, which is the bug this plan is supposed to fix.
  - **Adversarial:** 300 unknown items whose `batchId` and `fieldPresence` are near the limits fit under 60 KiB of input. They always fail with `RESULT_TOO_LARGE`, but only after all the CPU work from Finding 1.
- **Evidence:**
  - `src/domain/normalization-service.ts:299-313`: `unresolvedObservation` includes `observedText`, `candidates`, `trust`, and `evidence`.
  - `:566-568`: `.filter(o => o.reviewRequired || !o.canonicalId).map(unresolvedObservation)`.
  - `research-handlers.ts:84-85`: up to 5 suggestions per unknown name.
  - `test/research/research-handlers.test.ts:136-144`.
  - Plan (Phase 2): "`canonicalState.unresolved` không có `observedText` (`normalization-service.ts:562-597`) → mục cần rà soát phải giữ `observedText` trong observations gọn".
- **Suggested fix:**
  - Compact `unresolved` too: drop `evidence`, keep `observationId`, `entityKind`, `observedText`, `candidates`, `reason`, and `trust`. `unresolved` only feeds into the digest as a length (`reviewRequired`), so the digest is unaffected.
  - Stop copying `observedText` and `candidates` into the compact observations.
  - Add a worst-case test where everything is unresolved, at 300 items and under 60 KiB, and pick the item cap from that result.

## Finding 3: The compact output removes every "untrusted" marker from text supplied by the caller or OCR
- **Severity:** Medium
- **Location:** Phase 2, "Design" (the `canonicalState.heroes[]` and `tactics[]` lists, and `normalizedObservationSchema`)
- **Flaw:**
  - The domain layer marks every echoed observation `trust: "untrusted"` at two levels, and puts `trust: "untrusted"`, `sourceScope`, and `confidence: "manual"|"high"` on each canonical entity's `evidence`.
  - The compact design keeps `observedText` on review items but lists no `trust` field. It also removes `evidence` and `confidence` from heroes and tactics, so nothing marks them untrusted.
  - Yet `displayName` in the state is the caller's text: the observation's `displayName` wins over the catalog name.
  - With `confidence` gone, the reviewer can no longer see which entries came from a `manualCorrection` and which came from an OCR image.
- **Failure scenario:** OCR text or a pasted name containing instruction-like content ends up in `canonicalState.heroes[].displayName` or `observations[].observedText` with no marker. A GoClaw/Dewee skill that uses the per-field `trust` markers to decide what to quote versus what to obey now treats it as trusted server data. That is a prompt-injection path into the step where the user reviews and confirms.
- **Evidence:**
  - `src/domain/normalization-service.ts:435`, `:449`: `trust: "untrusted"` on sanitized observations.
  - `:114-120`: `evidenceFor` sets `trust: "untrusted"`.
  - `:146-152`: `displayName: selectText(observations,"displayName")`, `confidence` is `"manual"` or `"high"`.
  - `research-handlers.ts:94`: `displayName: observation.displayName ?? known.get(canonicalId)`.
  - `docs/goclaw-mcp-skill-handoff.md:58` (untrusted-data rule).
  - Plan: "`canonicalState.heroes[]`: `canonicalId`, `familyId`, `displayName`, `redStars?`, `level?` (bỏ `evidence`, `confidence`)".
- **Suggested fix:**
  - Keep `trust: "untrusted"` on every compact observation that echoes `observedText`.
  - Either use catalog names for `canonicalState` `displayName`, or add one marker for the whole state, such as a provenance entry `{artifact:"canonical-state", trust:"untrusted"}`.
  - Keep a short `manual: true` flag (or `confidence`) so the review step can still show which entries were manually corrected. Both are outside the digest.

## Finding 4: The 60 KiB request cap is measured on re-serialized JSON, but HTTP rejects the raw body at 64 KiB
- **Severity:** Medium
- **Location:** Phase 3, "Decisions" and "Tests Before" #1 and #5; "Risk Assessment" bullet 2
- **Flaw:**
  - `boundedRequest` measures `JSON.stringify(parsedValue)`, so non-ASCII characters are counted as raw UTF-8 and whitespace is dropped.
  - The Worker rejects the raw HTTP body at 65,536 B before any MCP parsing.
  - The raw body can be much larger than the measured value: `\uXXXX` escapes (6 B instead of 2–3 B for each Vietnamese letter), pretty-printing, `_meta` or progress tokens, and the JSON-RPC envelope all count.
  - That leaves 4,096 B of headroom, which those can exceed. The plan only tests the 60 KiB limit at the handler level, and the HTTP test uses 47 KB.
- **Failure scenario:** A client that escapes non-ASCII (Python `json.dumps` defaults to `ensure_ascii=True`, which `requests.post(json=...)` uses) sends 280–300 Vietnamese names at about 55 KiB after re-serialization. The Worker answers with a plain HTTP 413 `BODY_TOO_LARGE` instead of the typed `INVALID_REQUEST` the risk section promises. The same input works through the CLI or stdio, so the transports behave differently.
- **Evidence:**
  - `src/research/shared-schemas.ts:134-148` (measures after re-stringify).
  - `src/security/request-guards.ts:79-82`, `:129-135` (raw bytes compared with `maxBodyBytes`).
  - `src/worker.ts:291-294`.
  - `wrangler.jsonc:26`.
  - Plan: "`MAX_NORMALIZE_REQUEST_BYTES` = 60 KiB (61 440) để lọt body HTTP 64 KiB kèm envelope".
- **Suggested fix:**
  - Add a workerd test that sends a request exactly at the 60 KiB argument limit, with all non-ASCII escaped and with `_meta`.
  - Then either lower the argument cap to fit the worst-case raw size, or document 413 as the over-limit error for HTTP clients.

## Finding 5: How `--input-file` and stdin are read is not specified, and the CLI parser is synchronous with no stdin hook
- **Severity:** Medium
- **Location:** Phase 3, "Decisions" (CLI) and "Tests Before" #4; "Refactor" ("Chỉ đổi hằng và parse CLI")
- **Flaw:**
  - `parseCliArgs` is synchronous, exported, and unit-tested directly. `CliIo` has only `stdout` and `stderr`, with no stdin.
  - The plan doesn't say whether the 256 KiB limit is enforced while streaming or with a `stat` call followed by a full read.
  - A `stat` check fails on FIFOs and devices (`/dev/zero`, `\\.\pipe\…`, `CON`), which report size 0. It also has a time-of-check gap.
  - `--input -` with stdin that never closes blocks forever.
- **Failure scenario:** An agent shell or PTY runs `normalize --input -` and leaves stdin open, so the CLI hangs. Or an agent passes a path chosen by the model that points at a device or pipe, and `readFile` buffers without limit before the 256 KiB check, until the process runs out of memory.
- **Evidence:**
  - `mcp-worker/src/cli.ts:61-95` (sync parse; `--input` checked only with `TextEncoder`).
  - `cli.ts:43-46` (`CliIo` has no stdin).
  - `cli.ts:152-168` (every parse error becomes `CLI_USAGE`).
  - Callers that need updating for the new signature: `test/cli.integration.test.ts:10, 62, 75, 77, 80`; `test/transport/season-tools-parity.test.ts:63, 103`.
  - Plan: "cùng trần `MAX_REQUEST_BYTES` 256 KiB"; "file > 256 KiB → usage error".
- **Suggested fix:**
  - Read the input separately and asynchronously: open the file, reject anything that is not a regular file, and read in chunks, stopping at 256 KiB + 1 byte.
  - Add `stdin` to `CliIo` with a bounded stream read.
  - Add tests for a FIFO or non-regular file, for over-limit stdin, and for non-UTF-8 bytes.

## Finding 6: The temp-file handoff in `tqccl-auto` will fail on Windows and leaves roster data in %TEMP%
- **Severity:** Medium
- **Location:** Phase 4, "Files to Create / Modify" (tqccl-auto `call()`)
- **Flaw:** Phase 3 already adds `--input -`, yet the plan has `call()` write the payload to a temp file. There is no locking, permission, or cleanup design.
- **Failure scenario:**
  - Python's `NamedTemporaryFile()` (delete=True) on Windows opens the file with `O_TEMPORARY`, so `node` can't open it (EACCES). Every advise call fails.
  - With delete=False, the timeout path (`subprocess.TimeoutExpired`, mapped to `camnang_timeout`) skips cleanup unless a `finally` is written. The account's full roster, batch id `tqkh:<account>`, and locked teams pile up in %TEMP%.
- **Evidence:**
  - `../tqccl-auto/tqkh/advise.py:41-53` (`run([... "--input", text], timeout=120)`; timeout raises at `:51-52`).
  - `advise.py:178` (`batch = f"tqkh:{account}"`).
  - Plan: "`call()` ghi payload ra file tạm và gọi `--input-file` (bỏ `MAX_CMDLINE`)".
- **Suggested fix:** Use `subprocess.run([... "--input", "-"], input=text, ...)`, which passes the data directly with nothing on disk. Test it by giving the stub `run` 50 KB of input.

## Finding 7: The security and schema tests the plan relies on never run the compact normalize output
- **Severity:** Medium
- **Location:** Phase 2, "Tests After" and "Tests Before" #5
- **Flaw:** In both tests, the normalize result they actually check comes from `{ observations: [] }`. The scrubbing test sends a real normalize request, but only to get `workflowVersion` and the state for recommend; the result it asserts on is the empty one. So the scrubbing test and the output-schema test both run against empty `heroes`, `tactics`, `observations`, and `unresolved`. Saying they are "xanh với hình dạng mới" proves nothing about the new projection: the review-item branch, `candidates`, or the new schema's strictness against real data.
- **Failure scenario:** The compact projection leaves something in, or adds a field that is a long hex string or a non-scrub-safe value (for example an id derived from a digest). Both cited gates still pass, because neither one ever runs normalize on a non-empty roster.
- **Evidence:**
  - `test/security/no-long-hex-in-echoed-fields.test.ts:74` (`tqccl_normalize_entities: { observations: [] }`) and `:88-99` (loops over these results).
  - `test/research/research-handlers.test.ts:117`.
  - Plan: "`test/security/no-long-hex-in-echoed-fields.test.ts` … xanh với hình dạng mới".
- **Suggested fix:**
  - In both tests, use a non-empty normalize request that includes resolved, ambiguous, and unknown items, plus a locked team.
  - Assert that the compact output parses with `RESEARCH_CONTRACTS.tqccl_normalize_entities.output`.

## Finding 8: A player's account name and full roster go into a public repo
- **Severity:** Medium
- **Location:** Phase 1, "Context" and "Files to Create / Modify"; `plan.md` "Overview"
- **Flaw:** Phase 1 removes the account name only from the derived test fixture. The source file `research/full-roster-sample.json` keeps `"source": "<tài khoản> … (tqccl-auto state/<account>)"` along with the full 238-item roster and red-star counts. The repo's `plans/` folder is tracked in git, the repo is PUBLIC, and this plan folder is still untracked and waiting to be committed.
- **Failure scenario:** The plan folder gets committed with the PR, which publishes a named player's complete inventory. That conflicts with the project's own skill rule against exposing private account data.
- **Evidence:**
  - `plans/261118-1942-normalize-full-roster/research/full-roster-sample.json:2`.
  - `git ls-files plans` shows older plans are tracked; `git status` shows `?? plans/261118-1942-normalize-full-roster/`.
  - `gh repo view` reports visibility PUBLIC.
  - `.agents/skills/tqccl-coexist-team-builder/SKILL.md` hard constraint: "Never expose secrets or private account data (`no-secret-exposure`)".
- **Suggested fix:** Before committing, remove the account name from the research file (and from `plan.md` and the Phase 4 E2E text), or keep the source file out of git and commit only the scrubbed fixture.

## Finding 9: The live E2E test permanently changes the real account's saved state
- **Severity:** Medium
- **Location:** Phase 4, "Tasks & Steps" #3
- **Flaw:** "account `<account>`: bỏ toàn bộ `exclude` và nạp lại 145 chiến pháp" edits the user's live `state/<account>/kho.json`. That file holds 56 curated excludes, 37 tactics, and 23 identity picks. The plan has no backup or restore step. The edit also wipes the stored `confirmed` digest.
- **Failure scenario:** After the E2E run, the user's exclude list and confirmed state are gone. The next `advise recommend` returns `confirmation_required`, and the hand-curated excludes can't be recovered.
- **Evidence:**
  - `../tqccl-auto/state/<account>/kho.json` (picks 23, tactics 37, exclude 56, locked 0).
  - `advise.py:81-82` (`save_kho` overwrites the file).
  - `advise.py:219-227` (`confirmed` is tied to the digest).
- **Suggested fix:** Run the E2E against a copied state root (`--state <tmp>`), or make an explicit backup and restore step part of the task, and don't count the task done until the restore is checked.

---

## Contract Verifier: who consumes the changed interfaces
- **Normalize output shape:**
  - Inside the repo, `src/` never reads `observations[]`.
  - `scripts/verify-release.ts:406-416` reads only `workflowVersion`, `reviewRequired`, `canonicalState`, and `confirmationBinding`. It also compares `tools/list` byte for byte (`:107-135`), so the deploy must ship the schemas regenerated from this change.
  - Tests: `test/research/research-handlers.test.ts:56-73, 110-126`; `test/domain/normalization-service.test.ts:304` (domain only); `test/cli.integration.test.ts:164-215`; `test/transport/all-tools-parity.test.ts:106-136`; `test/security/no-long-hex-in-echoed-fields.test.ts:51-99`; `test/e2e/team-research-workflow.test.ts:13`; `test/performance/*-budget*`.
  - Outside the repo: `tqccl-auto/tqkh/advise.py:191-192` (observations) and `:199-216` (`canonicalState`, `unresolved[].observedText` at `:203`).
- **CLI options:** `parseCliArgs` / `runCli` / `CliIo` are used in `test/cli.integration.test.ts` (lines 10–130+) and `test/transport/season-tools-parity.test.ts:63, 103`. Help text is at `cli.ts:114`. Docs and skills that mention the CLI: `docs/goclaw-mcp-skill-handoff.md:77`; `.agents/skills/tqccl-coexist-team-builder/SKILL.md:34`; `~/.omp/agent/skills/tu-van-team/SKILL.md:31, 43-48, 55`. Lines 43–48 of `tu-van-team` (the CLI example block) are not in Phase 4.

## Verification Results
- **Claims checked:** 24
- **Verified (19):**
  - `research-contracts.ts:15-18` (`max(100)`) and `:26`
  - `shared-schemas.ts:6` (16 KiB) and `:262-299`
  - `research-handlers.ts:128-148` and `:182`
  - `tool-context.ts:118-126`
  - `canonical-state.ts:165-198`
  - `canonical-state.test.ts:59`
  - `normalization-service.test.ts:304` and `:699-714`
  - `research-handlers.test.ts:129-147`
  - `registry.contract.test.ts:269` and `:546-550`
  - `wrangler.jsonc:26-27`
  - `cli.ts:61-95` and `:114`
  - `recommend-handlers.ts:286-307`
  - `advise.py:188-196`
  - `goclaw-mcp-skill-handoff.md:39` (131072)
- **Failed (2):**
  - Phase 2: "`canonicalState.unresolved` không có `observedText` (`normalization-service.ts:562-597`)". It does: `:299-313` and `:566-568`.
  - Phase 3: a "238 mục" case in `worker-budget.workerd.test.ts` will catch the normalize CPU budget. That test never times normalize (`:93-95`), and the planned fixture skips name lookup.
- **Unverified (3):** none of these were re-run, since running code was outside this review's scope.
  - The pinned digest `sha256b64:qRtX_2qS…`.
  - The byte counts 111,054 / 32,517 / 47,115.
  - The "~310 items" estimate.

Status: DONE_WITH_CONCERNS
Summary: The plan's size and CPU gates use a canonicalId fixture that real clients never send, and they ignore the uncompacted `unresolved` list. Raising the cap to 300 items / 60 KiB is therefore unmeasured on both size and CPU. One key justification in Phase 2 is wrong.
Concerns/Blockers: Findings 1–2 (High) should be fixed in the plan before Phase 3 raises the input caps.