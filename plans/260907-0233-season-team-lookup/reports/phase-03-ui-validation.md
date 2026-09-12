# Season lookup interface validation

Date: 2026-09-12. Runtime verified: Node 24.20.0 / npm 11.19.0, `/Users/plateau/.nvm/versions/node/v24.20.0/bin`.

## Delivered behavior

- Existing nine Astro sections retained. Shared native scenario/ruleset controls; URL restoration uses the shared resolver. URL without context is reference, restored scenario-only never auto-upgrades, explicit scenario selection can choose its sole reviewed rule. Invalid context blocks scoped gameplay. Khai hoang stays latest-maintained and independent.
- Shell embeds SHA-256 byte hashes for five season sidecars plus teams, coexist, heroes, tactics, books. Browser caches each canonical request, validates every byte hash, then validates the complete model. Missing/mixed artifacts show an explicit legacy fallback notice and block scoped actions. Optional legacy tiers remain optional.
- Active hash owns query/filter application. Search replaces history; context/config opening pushes; closing removes only `config`, preserving current query and filters. Back/forward restores state without pushes. Invalid ordinary filters/scalar repeats and old stars are ignored with notices. Scoped cards count configurations, preserve variant identity, group effective tiers, expose sources, and open exact ordered details.
- Team rating stars removed; hero quality stars retained. Source scores remain original numbers (including 132.5), require exact displayed/selected heroes, tactics, books, units and conditions, and become absent after incompatible selection. Detail preserves raw effect labels/mechanics/condition references, provenance, ordered holder slots and explicit missing fields. Null upstream source season is supported.
- All-reference legacy rows keep separate `legacyRankings`/`legacyTier`, with full source/date breakdown labelled “Tier lịch sử — tham khảo”. Shared `tier:null`, unknown classification and zero applicable count remain intact. Scoped configurations never borrow legacy tiers or scores. Derived faction behavior runs on display copies.
- Local inventory comparison preserves base/SP identity, checks missing/locked/duplicate heroes and tactics, and explicitly leaves books and unsupported conditions unverified. Empty inventory opens existing import/scan flow. No strength score is inferred from readiness.
- Roster recommendations project exact executable configs before engine use, retain locks and their optional configuration identity, reject 501 eligible candidates without stale portfolio, and use final engine selections for source scores. Scope changes invalidate confirmation/results synchronously while retaining inventory. Late compression/scan completions cannot repopulate the changed scope.
- Soi đội uses the scoped candidate projector, blocks scenario-only/invalid matching and exposes explicit outside-scope reference opt-in. Matching outside scope remains labelled reference. Cùng Tồn separates applicable/reference/unknown groups and counts; all raw ordered slots, multiline notes, advisor annotations and troop-tactic effects remain text nodes, with source links. No PK tier or source score is attached to reference groups.

## Red → Green evidence

Meaningful behavioral Red was observed before fixing each following failure:

| Surface | Observed Red |
|---|---|
| Shared controls / real data | Scenario selector absent |
| Configuration cards / detail | Both config identities absent; inventory action absent |
| Scoped roster / analysis | Config result absent; scenario-only notice absent |
| Cùng Tồn search | No search input or restored query flow |
| Locked state | Serialization dropped teamId/configId/context |
| Late scan | Old response added Anh after scope changed |
| Close/history | Closing after search lost `q=Bình` |
| Mobile / focus | 320px card extended to x=332; detail close scrolled behind header |
| Legacy tiers / faction | Historical badge and derived Thục facet absent |
| Recommendation actions | “Nên thêm” nested array rendered no actionable team |
| Score selection | Card showed 132.5 for Anh while valid source selection used Dũng |
| Raw effects / null source season | Effect labels/mechanics absent; null source season prevented detail render |
| Fallback query | Missing season bundle plus ordinary q incorrectly disabled legacy confirmation |
| Query scalar validation | Repeated q silently selected Anh |
| Applicability grouping | Exact-pair coexist group had no applicable heading/count |
| Card context | Card omitted its own scenario/ruleset label |
| Optional conditions | Informational condition incorrectly claimed build was blocked |
| Keyboard facets | Activated chip had correct pressed state but lost keyboard focus |

No missing-module/import failure is counted as Red. Some additional byte-hash, filter-combination, inventory identity, responsive and invalid-context edge checks were added as post-implementation regression coverage; they are not claimed as independent pre-code Red cycles. Turnstile and image-service responses are isolated browser test boundaries; source/game data fixtures never enter production artifacts.

## Verification

- UI state + scan-state + shell/runtime contracts: **24 passed** (6 UI + 8 scan + 10 shell/runtime), final exact-runtime run.
- Astro check: **0 errors / warnings / hints**, final integration checkpoint.
- Dev browser: **26 passed**, then the optional-condition and keyboard-focus additions each ran meaningful Red → Green with their affected regression cases.
- Built artifact full E2E: **54 passed in 40.2s**, including existing Khai hoang, Chạm Sứ, hash navigation, optional/missing data, storage and MCP browser parity.
- After the final keyboard-only filter update: fresh default build + **all 28 season E2E passed in 12.6s**. The unchanged 27 pre-existing E2E were not repeated after this small fix; they passed in the preceding full run.
- Final `git diff --check`: passed.
- Final commands prepend `PATH=/Users/plateau/.nvm/versions/node/v24.20.0/bin:$PATH`. Default Playwright manages build/preview; no deploy performed.

## Visual and keyboard evidence

Real Binh Diễn Xuân Thu screenshots: [375px](ui-real-binh-dien-375.png), [1280px](ui-real-binh-dien-1280.png).

Controlled configuration detail: [375 light](ui-detail-375-light.png), [375 dark](ui-detail-375-dark.png), [1024 light](ui-detail-1024-light.png), [1024 dark](ui-detail-1024-dark.png).

Playwright checks source/facet keyboard focus preservation and 320/375/768/1024 widths in light/dark, no horizontal overflow, visible native-select focus, 44px controls, close focus restoration, and close control positioned below sticky navigation. Source links use theme tokens. Screenshots above were recaptured from the final built preview, without the Astro dev toolbar.

## Process and limits

No owned dev server was created: Astro reported existing user server localhost:4321 PID 77549, which was reused and left running. Built gates used Playwright-managed preview 127.0.0.1:4174; PIDs 70495, 83115 and final 89141 were stopped by the runner. Final port check found no listener. No deployment, commits, shared resolver/data edits or added game facts.

Chromium is the exercised browser; physical devices and other browser engines were not tested. Production registry intentionally has no reviewed ruleset/config/evaluation: real Binh Diễn displays five scenario-reference groups / 25 teams, not fabricated executable teams. Root owns final integrated dist/verification and broader repository gates, evergreen docs and plan status.

Status: DONE_WITH_CONCERNS. Product scope delivered; TDD chronology limitations and browser coverage are disclosed above. No known failing UI gate or unresolved implementation blocker.
