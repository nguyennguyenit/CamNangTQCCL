# Season lookup UI integration advice

Date: 2026-09-12. Read-only source review; no UI implementation or browser validation performed.

## Recommendation

Keep the existing nine-section Astro shell and vanilla DOM builders. Add one shared context control above the section mounts, use the existing inline filters, and open details by exact config identity. Keep current system font, CSS tokens, faction colors, grid and mobile filter collapse. No framework, new page, new navigation section, or backend.

Research skill searches were consulted for product/style/typography/color. Generic gaming neon/3D suggestions do not fit the existing data dashboard; repository guidelines take precedence. No new font or palette needed. `docs/development-rules.md` is absent; supplied AGENTS rules and existing design guidelines govern.

## Concrete placement

- In `src/pages/index.astro`, mount a shared context region inside `.content`, before the nine existing sections. Keep it outside each section's `replaceChildren` boundary. Show on Team PK, Meta phe cũ, Cùng Tồn, Soi đội and Gợi ý kho; preserve selection while visiting other sections. Khai hoang remains latest data and has no season/source UI.
- Two native selects with visible labels: **Kịch bản đang chơi** and **Phiên bản luật**. First option: **Tất cả — tham khảo**. For scenario-only, ruleset option: **Chưa chọn — tham khảo**. Only reviewed rulesets become executable choices. With no reviewed rule, keep an explanatory line visible even if the ruleset select is disabled: **Chưa có phiên bản luật được xác minh. Bạn vẫn có thể xem đội tham khảo.**
- Desktop: two compact flexible columns and status line below. Mobile: stack fields, full width, minimum height 44px, input text 16px; do not put context inside collapsed filters. Avoid making another large sticky panel. Replace the currently hardcoded global tagline with a short accurate summary, and a neutral latest-data label when viewing Khai hoang.
- Retain search then **Bộ lọc / Xóa lọc / count**, adding the agreed sort control. Reuse `.team-filter-bar`, `.fgroup`, `.fchip`, `.team-grid`; new context styles use `--panel`, `--line`, `--ink`, `--muted`, `--accent`.

## State and URL owner

`app.js` owns normalized browse state and active section query. Current code only listens to hashchange; `pushState` does not invoke it, so explicit state application is required.

| State | Visible meaning | Gameplay |
|---|---|---|
| all-reference | Tất cả — tham khảo; unknown content in its labeled group | Explicit legacy no-context behavior |
| scenario-reference | Scenario name; Chưa xác minh phiên bản luật | No match/recommend/replacements |
| verified-pair | Scenario + exact reviewed ruleset | Exact executable configs only |
| invalid | Specific invalid pair/ID notice; retain controls | Block; clear old effective context |

No URL context opens all-reference, even if local storage contains an older pair. Restore scenario-only URL as scenario-reference, including when exactly one reviewed ruleset exists. Auto-select that sole reviewed rule only after an explicit new scenario selection on the UI. Never auto-select the largest season.

One `applyLocation()` path parses URL, resolves context, applies the active section filters/detail, then updates UI without writing history. Call it from both popstate and hashchange with an idempotent state comparison. User actions use one `commitState(next, historyMode)` path. Search uses replaceState; scenario/ruleset changes and config opening use pushState. Preserve hash contracts. Reject unknown config or wrong scope with inline explanation; never search the first hero as fallback.

Support `scenario`, `ruleset`, `q`, repeated `faction/unit/tier/source`, `sort=tier|sgsdeck-score`, `config`. Repeated filter values are OR; groups are AND. Ignore invalid ordinary filter values with notice; invalid context remains blocked. Ignore old `stars` filtering without translating stars into score. Preserve per-section filters in memory; URL describes the active section. Switching sections writes that section's filter state while preserving shared context, so source filters from another section do not leak silently.

**Xóa lọc** clears query/filter selections and restores default sorting for this section. It never changes scenario/ruleset. Scope changes retain valid ordinary filter selections, recompute facets, close a no-longer-valid detail, invalidate old results/confirmation synchronously, then load/project. Async results carry a generation token and are discarded after any scope change. Preserve inventory and reviewed canonical scan data.

## Existing code integration

- `team-filter-section.js` currently closes over immutable input teams/private state and recreates the grid. Extend its existing controller with an update operation accepting projected items + filter state + selected config, and an `onStateChange` callback. Keep search/select DOM stable during typing and scope rerenders to avoid losing keyboard focus. `setSearch` remains compatible. Update facets against the current projected scope, not all canonical teams.
- `team-pk.js`/`meta-cu.js` remain source-owning wrappers. Remove the team stars group, old stars intro copy and stale implicit stars filter adapter. Preserve source filtering and add tier/score sorting from resolved config evaluations. Meta old-source wording is **Nguồn tham khảo từ các mùa trước**, not a blanket invalidation statement.
- `render.js` consumes resolved display models. Never join scoped tier/score by teamId alone; current `tierIndex.get(t.id)` is insufficient for two configs of one team. Keep legacy behavior explicitly separate. Render **Điểm SGSDeck: [original value]** or **Chưa có điểm SGSDeck**, not percentage or zero substitute. Replace the decorative star in the boolean **Khuyến nghị** label with text; hero quality/star presentation is unaffected.
- `app.js` changes Cùng Tồn's one-time append to replaceChildren on projection updates. Preserve source group order, raw multiline text, ordered heroes and conditions. Column J label: **Cải tạo chiến pháp binh chủng**. Advisor requirement remains separate. Reference Cùng Tồn has no PK tier/SGSDeck score.
- `onOpenTeam` carries `configId` and validated context, routes to the existing owning section, and opens that record. An ambiguous canonical team must present config choices rather than choosing one silently.

## Cards, details and empty states

Team PK groups use normalized tier order and per-group **cấu hình** counts after filtering. Unknown and scenario-only reference are separate labeled groups with separate counts. A missing tier has its own label; it is not T0 or out-of-meta. Score sorting is stable descending, null last, within the same applicable context; keep tier groups as the primary hierarchy.

Compact card: team name, three variant-correct hero names, unit/faction, tier, score and context status. Use an explicit **Chi tiết cấu hình** control rather than nesting a clickable card around tag buttons. Inline disclosure fits current native `details` usage and avoids a new overlay system. It exposes holder order, tactics, books, stat allocation, alternatives, operating conditions and validated source links. Missing fields say **Chưa có dữ liệu**. Details render text safely; sources accept only reviewed http(s) URLs and never raw HTML.

Opening writes `config`, moves focus to the detail heading/control, and retains list filters. Closing a UI-opened detail returns to its known list history entry; direct-linked detail close removes only `config` with replaceState, avoiding accidental navigation offsite. Back/Forward restoration never emits a second history entry. Focus returns to its trigger; if filtering removed that trigger, use the list heading. Invalid config preserves the filter/context URL and shows an actionable notice.

**Đối chiếu kho của tôi** belongs inside detail. With no inventory, open the existing import/scan path. With inventory, distinguish **Đủ tài nguyên đã đối chiếu** from strength/tier. Unverified mandatory condition: **Chưa xác minh điều kiện**, with reason; never label **Dùng ngay** merely because names match. In scenario-reference, show why gameplay is unavailable and direct the user to reviewed ruleset selection or an explicit all-reference choice.

Use context-specific empty messages:

- Filtered empty: **Không có cấu hình khớp bộ lọc trong [context].** Keep Xóa lọc.
- No reviewed rule: the normal reference-only message above, not a loading/error screen.
- Cùng Tồn exact pair empty: **Chưa có bộ Cùng Tồn được xác minh cho phiên bản luật này.** Scenario-reference may remain separately visible.
- Scenario without references: **Chưa có bộ Cùng Tồn cho kịch bản này.** No other-season fallback.
- Missing/mixed artifact generation: clear availability notice; seasonal controls/actions unavailable. Legacy view may be offered under explicit reference labeling, never under the requested pair label.
- Candidate limit: **Quá nhiều cấu hình phù hợp phạm vi; chưa thể tạo gợi ý.** Keep inventory/browse and discard old portfolio; no first-500 result.

## TDD and manual acceptance

1. State tests first: URL beats local, no-context reference, restore scenario-only does not auto-upgrade, invalid pair blocks, explicit new-scenario action sole-reviewed auto-selection, repeated filters and old stars ignored.
2. Lifecycle tests: scope change clears confirmation/result before async completion; stale completion ignored; inventory retained; Cùng Tồn groups never duplicate after repeated updates.
3. Query/detail tests: two configs sharing teamId open different holders/tactics; reload/back/forward/close restore exact config and filters without history loops; rejected wrong-scope config never falls back.
4. Render tests: applied/reference/unknown counts separate, stable tier/score/null sorting, SGSDeck >100 preserved, team stars absent but hero stars intact, J/advisor/multiline/reference source boundaries preserved.
5. Real-data flow: no reviewed rulesets produces normal reference browsing and zero executable configurations; no synthetic runtime rules added to make the flow appear complete.
6. Browser checks at 320/375/768/1024px in both themes: no page overflow, long Vietnamese labels wrap, three heroes readable, sources usable without hover, fields/buttons ≥44px on mobile.
7. Keyboard: visible label association, native select keys, Tab order matching layout, pressed chip state via aria-pressed, collapse aria-controls/expanded, detail open/close focus restoration. Avoid copying the current hero overlay's incomplete focus handling. New live result/status region uses polite announcements without moving focus on every filter change.
8. Reduced motion: current CSS handles transitions; explicit `scrollTo({behavior:'smooth'})` calls still need reduced-motion-aware behavior. Test opening details and tag search under reduced motion.
9. Preserve nine section hashes, mobile section menu and independent Khai hoang/mỏ/Chạm Sứ state. Complete focused Node/Playwright then root-owned check/build/dist/verify gates.

Unresolved questions: none requiring user input. Implementation controller chooses exact helper API and detail container while preserving these contracts.
