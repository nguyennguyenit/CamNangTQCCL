# Recommended browser research

Observed 2026-09-12, Asia/Saigon. Real public browser session `recommended-research`, no login, no source mutation. User supplied two screenshots then requested browser inspection and a new plan. No all-season ingestion performed in this planning pass.

## Contract from user

- Recommended like SGSDeck in behavior, using existing website styling.
- Keep existing filters, supplement searchable season selection; do not rebuild equivalent controls merely to match the screenshot.
- Group by source Tier; no score filter and no sorting control. Fixed rank order.
- Each list card shows three heroes, their tactics and books. Clicking team opens full local description.
- Remove user-facing ruleset selector. This does not authorize deleting internal gameplay validation or promoting TW as VN.
- Scope includes Recommended storage/display, previously confirmed YES. No pending rights question.

## Live observations

| Surface | Observed behavior | Evidence |
|---|---|---|
| [Default list](https://sgsdeck.com/recommended) | Binh Dien `og-兵演春秋`,25 PK configs; T0=12,T0.5=1,T1=12 | source-season-picker.txt, source-season-picker.png |
| Season picker | Search textbox; groups in-progress/PK/early seasons; code,name,status,count;29 options. Metadata reflects source region, not VN availability. | source-season-picker.txt |
| [S28](https://sgsdeck.com/recommended?season=pk-s28) |93 PK configs. Same title and three heroes can recur with different IDs/rank/faction. T2 group includes both82 and72 scores, so Tier is not a score-derived threshold. | source-s28.txt |
| S28 + Nguy | Selecting faction魏 changed URL and reduced93→21. Only魏 chip remained in source facets, an observed source quirk; do not copy this over local usable filters. | source-s28-faction.txt |
| S28 Khai hoang |0 config; units cavalry/shield/bow/spear, Tier and碰瓷; no PK subcategory row. | source-khai-hoang.txt |
| S28 siege |0 config; unit器 only, Tier; no PK subcategory. | source-siege.txt |
| Season search | TypingS21 yields PK-S21亂世烽煙, marked uncollected; selectable. Switching from S28 while siege retainedcategory. | source-empty-season.txt |
| Empty season | Distinct message that season has not been collected; different from zero matching configs in a category. | source-empty-season.txt |
| [Team detail](https://sgsdeck.com/recommended/s28-feixiong-tai-wei-qi) | Intro,sourceauthor,T0/113,season,faction,ordered heroes,2tactics+3books perholder,statfocus, optional equipment trait援助; no public login needed to read. | source-team-detail.txt, source-team-detail-content.txt, source-team-detail.png |
| Tactic drilldown | Clicking撫輯軍民 opens accessible dialog: effecthistory,quality,type,activation,target,release season,inherit/event requirements. | source-tactic-detail.txt |

Source category links are開荒/交戰/器械. PK subcategory links第一隊/交戰/賊寇. Tier optionsT0,T0.5,T1,T1.5,T2,T3,FUNC. Source ranks must be preserved independently of numeric score. Exact category membership cannot be inferred solely from current list title or three hero names.

## Implementation gap verified locally

`pipeline/sgsdeck_recommended.py` supports one selected scope per cache, requires exactly3 ordered holders and2 nonempty tactics each; carries no complete multi-season/category registry, equipment trait field, full richdescription model or translation review. Expanding scope must support truly source-missing slots without fabricating content or weakening proven mismatch checks. Existing25records/onecachedscope are not evidence of full sourcecoverage.

`js/app.js`/`season-ui-state.js` use reviewed VN scenario/ruleset pairs for gameplay. New source browsing must not use that gate to hide TW reference cards. Dedicated Recommended routes avoid adding scores to eligibility models and avoid changing latest-maintained Khaihoang.

Existing local styles/search/faction/unit/tier/source chips and card hero/tactic/book DOM can be reused. Source list currently hides tactics/books until detail; user explicitly wants them visible on local cards.

## Work already started before latest planning request

Worktree `feat/season-team-lookup`, baselinee39db07. Uncommitted parser/evidence/test spike adds tierRaw/factionRaw: focused14Python tests pass, one new Red→Green assertion case. It is NOT feature completion. Untracked `src/lib/recommended-reference-data.mjs` is unused/unverified display prototype, hardcodes one source season and character transliteration; do not use it as accepted architecture or canonical mapping. No browser UI activated. Old clean-source attestation applies only toe39db07, not current dirty spike. Preserve original main WIP.

## Limitations and tooling

- Browsed defaultBinhDien, S28PK, faction, Khaihoang, siege, S21empty and one S28detail/tacticdialog. Other season contents not inspected or imported; implementation must discover and reconcile each source scope.
-29options observed, not29complete datasets. Counts in dropdown must be verified for category scope before reconciliation.
- Two `agent-browser wait --url` calls timed out while actual navigation succeeded; subsequent snapshots and URLs verified the states. No repaired skill code or changed browser installation. Avoid claiming waits passed.
- No login/accountcopy, private endpoints, bulk import, push,merge or deploy in this research.

## Unresolved

No product clarification required. Full corpus counts, missing slots and category membership are implementation discovery gates, not facts guessed from this sample.

## Player sharing verified and final navigation decisions

Live browser also inspected [SGSDeck player sharing](https://sgsdeck.com/teams):49public configurations observed, author/season,revision,votes and ratings controls. These are separate from `/recommended`; a source URL hosted on SGSDeck does not by itself establish membership in the Recommended Tier List. See `source-player-teams.txt`. No player post was imported or published. The new site does not need vote/rating/submission features for this request.

User final names: **Team chuẩn** = SGSDeck Recommended; **Team khác** = different hero+tactic builds. Compare assigned tactics perhero, notjustthreehero names; books alone do not create a different intake build. Preserve base/SP/CO/40Y identity and source full configuration independently of dedup key.

Latest user explicitly authorizes initial **existing local teams** that do notduplicate SGSDeck in Team khác. This overrides the earlier proposal to require fresh research/battle reports for every legacy record. Preserve known source labels; unknownsource staysunknown. Future additions from research/player battle reports require their actual attribution. Do not invent a research-source statement for unsupported legacy data. No new user-submission backend is in this plan.
