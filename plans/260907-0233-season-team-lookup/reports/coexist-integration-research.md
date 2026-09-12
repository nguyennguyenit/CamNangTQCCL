# Cùng Tồn: integration research for phases 1, 3 and 4

Date: 2026-09-07. Scope: `--deep --tdd`, PLAN ONLY. No runtime/data edits, builds, fetches or deployment performed. Read plan index and all four phase files. This report uses current source evidence; prior memory inventory was not used as current truth.

## Established constraints

User confirms source sheet `gid=190730430` describes Binh Diễn Xuân Thu and asks to retain the old unknown-scope set. Record this as user-confirmed source scenario identity; it does **not** independently prove a regional balance/ruleset mapping, every group's validity under all replays, or availability of canonical engine configurations. Do not infer the old set's scenario from its heroes, tactics, the shell tagline, or current sheet content. Keep reference display separate from resource-validated recommendation.

## Current owners and evidence

- `src/pages/index.astro:21` owns the hard-coded global tagline “Mùa: Binh Diễn Xuân Thu”; no `src/components` directory or `FrontendShell.astro` exists. The nine tabs/empty mounts are here at lines 29–56 and the app script at line 64. Phase 3 must replace this fixed claim as well as the already-planned Khai hoang claim.
- `js/app.js:77–94` loads all coexist groups and appends them exactly once. Shared context must trigger replacement/re-render of this mount, not another append that duplicates groups. The lifecycle seam currently exists only for Team PK and Meta cũ (`88–91`). Navigation mutates only hash (`47–69`); scope query and popstate handling must be integrated centrally without creating a separate Cùng Tồn context preference.
- `js/render.js:154–188` renders nested reference groups: groupLabel, optional summary details, teams/teamName, hero name/tactics/books/statFocus/advisorSkill. Preserve all fields and existing summary behavior. It has no tier, source score, scope, provenance, or canonical ID handling.
- `data/coexist.json:1–9` shows the legacy array/group shape and repeated display-only labels. A label is unsuitable as a stable identity. Existing unknown records must receive sidecar identity/fingerprint without positional association or historical relabeling.
- `src/lib/public-artifact-manifest.mjs:17–50` owns exact public JS/data entries including coexist at line 43. `tests-js/astro-dist-contract.test.mjs:20–38` requires every root data/JS/CSS file to be classified. `scripts/verify-astro-dist.mjs:29–53` enforces exact dist inventory. Adding a separate coexist artifact accidentally changes the plan's five-sidecar/11-MCP-artifact agreement; prefer the planned content-links plus existing coexist artifact unless controller explicitly revises the inventory.
- `tests-js/runtime-asset-contract.test.mjs:60–75` pins the six required legacy loads and optional tier; lines 78 onward pin nine hashes and cross-section navigation. Preserve legacy fallback and intentionally update checks affected by hash-verified loading with behavioral replacement tests, not deletion of assertions.
- `mcp-worker/src/data/artifact-contracts.ts:4–46` pins six array artifacts/schema v1. Its coexist validator (`187–204`) validates groupLabel and nested teams/heroes, not canonical scored team identity. `snapshot-index.ts:183–227` indexes teams/heroes/tactics/books, not coexist. Cùng Tồn scope support does not require a new search kind.
- `mcp-worker/src/domain/recommendation-service.ts:206–223` runs the regular team engine, then attaches up to 50 coexist references and warning `coexist-reference-not-scored`. The projection only copies id/displayName/name/note, while actual corpus uses groupLabel/summary/teams: actual legacy groups therefore lose useful content and generally return only trust. Existing fixture at `mcp-worker/test/domain/recommendation-service.test.ts:38` uses synthetic displayName/note, masking this mismatch; regression at `273–287` should be extended with actual corpus-shaped minimal fixture.
- `mcp-worker/src/research/research-contracts.ts:684–688` bounds coexistReference to 50 generic records. `research-handlers.ts:574–598` additionally applies boundedJson and fitResultSize; retain truncation reporting when introducing useful scope-aware reference projection.
- `mcp-worker/scripts/build-worker-assets.ts:112–117,222–268`, `verify-worker-assets.ts:18`, and `verify-release.ts:197–198,387–389` assume the exact v1 inventory. Update by explicit version branch as already planned, never global count replacement.
- `mcp-worker/workflow-source-manifest.json:8–30` lists semantic modules. Add the shared season resolver to the semantic closure when imported into MCP, so changes invalidate workflow binding. Preserve v1 fixtures and legacy no-context behavior.

## Precise phase additions

### Phase 1

1. Inventory two independent source sets: newly confirmed `gid190730430` / Binh Diễn Xuân Thu, and preserved legacy unknown set. Store exact source locator, user-confirmation evidence and snapshot/hash alongside what remains unverified. Do not upgrade ruleset review merely from the confirmed scenario name.
2. State separately source-scenario attribution and ruleset applicability; scenario-known/ruleset-unknown must be representable by content links with a null ruleset and explicit pending status. Only reviewed pairs activate gameplay scope per the existing plan. No default latest season and no automatic ruleset fabrication.
3. TDD: confirmed scenario with absent ruleset remains pending for applicability; same labels across sources do not merge; legacy set remains unknown after adding confirmed set; source-confirmation does not imply reviewed hero/tactic identity. Existing corpus byte invariance applies to the legacy set, while the new import must be an explicit phase-2 ingestion change.

### Phase 3

1. Correct owner list to actual shell `src/pages/index.astro`; remove fixed season tagline or derive it exclusively from valid shared selection. Do not hide an invalid context behind Binh Diễn copy.
2. Make Cùng Tồn mount re-render from the shared projector. Selected reviewed pair shows applicable reference groups; the old set stays accessible in an explicitly separate “Chưa xác định kịch bản — tham khảo” area or under “Tất cả — tham khảo”, excluded from applicable counts. Empty reviewed scope remains empty and explains why; no fallback to the old set.
3. Keep nested teams and hero detail lines, summary disclosure and source attribution. Count groups and constituent teams with explicit separate labels if both are shown; do not call a group a canonical candidate or add PK tier/SGSDeck score to it.
4. TDD with both new and legacy records: changing shared scenario while on #coexist updates without duplicates, reload and back-forward restore context, legacy hash works, unknown never silently enters scoped counts, pending ruleset remains reference-only, zero results explains context, existing summary/details survive. Reuse `tests-e2e/spa-parity.spec.mjs` infrastructure and add a focused season/coexist behavior spec if needed. Validate both datasets against the same shell generation hash, with mixed-generation failure fallback.

### Phase 4

1. Filter coexistReference using shared content-link resolution; retain no-context compatibility and never score the reference text. Preserve warning `coexist-reference-not-scored` regardless of scenario confirmation. Reviewed canonical configs may participate only via the normal explicit teams/config path, not automatic group parsing.
2. Add useful bounded scoped reference output: stable sidecar record ID, groupLabel, scope/provenance, and bounded nested display content or an explicit bounded summary. Keep trust untrusted. Treat this as v2 output behavior; do not silently alter a frozen v1/no-context fixture projection.
3. TDD with actual group-shaped data: correct scope returns only its reviewed groups; old unknown records remain reference-only; nonmatching/pending groups cannot boost scoring or alter candidate order; no-context output parity; oversized nested content truncates with reporting; UI/MCP IDs and applicability agree.
4. Run focused data/domain/research tests first, then existing transport parity, release/version fixtures, workflow closure/build checks. No new artifact/search tool is needed solely for the Cùng Tồn extension. Snapshot update must preserve v1 hashes and create a fresh v2 identity; do not publish.

## Conflicts to resolve in plan text

- “Corpus cũ bất biến” in phase 1 must mean preserve original legacy records during sidecar generation, not prohibit the user-requested additive source import in phase 2. Record separate baselines for the old set and curated additions.
- Scenario confirmation is accepted; remaining ruleset evidence is a different question. No re-confirmation of sheet scenario identity is needed.
- Current plan's only explicit hard-coded-season removal covers Khai hoang; include global shell tagline too.
- Scope filtering alone cannot make current MCP coexistReference informative because its existing projection does not match the real artifact shape. Add the bounded v2 projection above while preserving legacy policy.

Unresolved evidence: exact ruleset applicability of the confirmed sheet; canonical IDs and applicability of legacy groups. These remain pending in inventory, not inferred and not blockers to writing this plan.

Status: DONE
Summary: Located concrete shared UI, public-asset and MCP seams, plus a real coexist reference projection mismatch. Proposed phase additions preserve legacy unknown content, shared context and reference-only semantics.

## Controller option assessment: inline reference sidecar

The simplest owner for new source data, while freezing legacy `coexist.json` bytes and keeping five sidecars/11 MCP artifacts, is an optional **discriminated inline reference target** in `season-content-links.json` for `kind:"coexist"`. Define exactly one of legacy locator or inline payload, not two overlapping optional fields with unclear precedence. The inline target owns source-scoped stable record ID, content fingerprint and nested display payload; the link owns scenario/ruleset applicability/evidence. Its ID namespace must not collide with legacy locator IDs or canonical team IDs. Do not infer that an inline reference is a canonical config.

Builder cross-reference validation branches on the target discriminator: legacy requires a unique fingerprint match in coexist.json, inline validates its own payload/fingerprint. Reorder must not change IDs; duplicate/conflicting IDs and both/neither target forms fail. Browser and MCP consume the same resolver result, with MCP applying bounded projection after resolution. No new search kind, no extra artifact, no legacy corpus mutation, and no engine scoring extension is necessary. This supersedes the report's additive-import assumption: source ingestion can write the curated content-links input and its generated output exclusively rather than coexist.json.

Scenario-only reference browsing is compatible **as an explicit distinct state**. It must not masquerade as effective `{scenarioId,rulesetId}` seasonContext. A confirmed scenario with no reviewed ruleset can display attributed reference material and the unknown applicability notice; recommendation and gameplay matching continue to require reviewed ruleset or explicit legacy mode. Avoid introducing a second independent selector: derive reference browsing scope from the shared scenario selection, and derive effective gameplay context only when the pair validates. The controller reports a user question pending on this UX; do not mark it accepted until resolved. TDD must prove scenario-only selection never triggers recommendation or labels references as ruleset-reviewed; it invalidates the previous effective confirmation while preserving inventory. This clarification supersedes the earlier binding-preservation wording and follows the final phase-3 transition contract.

## Focused test inventory and final planning contract

Read `reports/coexist-planning-contract.md` before final handoff. Its source-owned payload proposal, immutable legacy bytes, four-phase structure and proposed scenario-only distinction agree with the assessment above. Source acceptance is 5 groups / 25 teams / 75 hero positions, retaining raw alternatives and the column-J unit-tactic conversion semantic; no new parser implementation is part of this report.

Static focused test declaration inventory (not a passing execution count): artifact-contracts 9 `it/test` declarations; recommendation-service 8; research-handlers 31; frontend-shell-contract 4; runtime-asset-contract 5. Counts were obtained by anchored source search and exclude parameterized expansion. No tests were executed for this read-only planning subtask. During implementation, run only the touched focused tests first, record actual Red/Green counts in validation, then broaden to the already-planned gates.
