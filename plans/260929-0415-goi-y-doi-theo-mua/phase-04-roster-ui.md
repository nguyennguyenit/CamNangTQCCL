# Phase 4 — Roster UI: season select, Thiếu món, "Vì sao?"

## Boot (`js/app.js`)
- Roster page loads the Recommended generation via existing `loadRecommended()` (verified pin) plus
  `teams.json`/`team-tier.json` (fallback). Recommended failure → tool still runs on legacy with a notice.
- Pass `{ recommended: { records, seasons }, teams, teamTier, heroesDict, tacticsDict, onOpenTeam, teamHref }`.
- `SECTION_QUERY_KEYS['/goi-y-doi-tu-kho/'] = ['season']` (`js/team-detail-navigation.js`); update its test.

## UI (`js/roster-recommend-ui.js`)
- Controls: `<select>` "Mùa bạn đang chơi" with `seasonOptions` (reuse `/doi-chuan/` option text:
  extract `seasonOptionText`/`seasonOptionTitle` from `team-filter-section.js` into a shared helper — no copy).
  Default `readRecommendedQuery(href, registry).season`; change → `history.replaceState` `?season=` + rerender.
  `all` not offered.
- Results:
  - Portfolio rows: season entries → link to `/doi-chuan/<mùa>-<handle>/` via `teamDetailHref({sourceConfigId})`;
    legacy entries → badge "Tham khảo – đội cũ" + existing legacy link; `usedAlternatives` → "Đã thay: A → B".
  - Section "Thiếu món" (season blocked teams, max 5):
    - missing hero → button "Tôi có tướng này" → `addItem('heroes', name)` then auto re-run recommend.
    - missing tactic → "Tôi có chiến pháp này" + radio list of substitutes (`N cấu hình cùng mùa`) +
      "Vì sao?" per substitute. Choosing a substitute stores override → re-run.
    - Keep state confirmed when the change comes from Thiếu món (user acted on a result, not a new scan).
  - "Vì sao?" needs a Turnstile token (same widget); shows result inline (`aria-live`); in-memory cache by
    `(missing, substitute, hero, locale)`; resets widget after use.
- Notice text updated: AI đọc ảnh và chỉ giải thích món bù khi bạn hỏi; đội được chọn bằng công cụ cục bộ.
- CSS: new classes only via tokens (`css/styles.css`), remove comment "chạy trên dữ liệu đội cũ, không có bộ chọn Mùa".

## Checks
- Throwaway smoke in browser (preview server): default season, switch season, legacy fill label,
  "Tôi có…" recompute, substitute selection, "Vì sao?" with mocked Worker.
