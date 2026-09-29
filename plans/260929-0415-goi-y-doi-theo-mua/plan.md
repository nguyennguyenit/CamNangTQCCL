---
title: Gợi ý đội từ kho theo mùa + mục Thiếu món
description: >-
  Đổi nguồn ứng viên của /goi-y-doi-tu-kho/ sang đội chuẩn theo mùa
  (recommended-reference), lấp bằng teams.json cũ khi thiếu, thêm mục Thiếu món
  với món bù suy từ dữ liệu và nút "Vì sao?" gọi Worker mode explainSubstitute.
status: pending
priority: P1
branch: main
tags: [frontend, worker, team-recommendation, localization, tdd]
created: '2026-09-29T04:15:00+07:00'
source: ak-advise → ak-cook --tdd
---

# Gợi ý đội từ kho theo mùa

## Blocker
Worktree đang có một phiên khác chưa commit (~200 file, gồm `js/app.js`, `js/analyze.js`,
`worker/src/*`, `tests-e2e/beta-tools.spec.mjs`, `pipeline/site-localization-policy.json`,
generation Recommended mới `3f6b33cf…`). Người dùng chọn **đợi phiên đó commit** rồi mới làm.
Trước khi bắt đầu: `git status` sạch ở các file trên, đọc lại số liệu dữ liệu ở generation đang pin.

## Confirmed outcome (ak-advise)
1. Một ô "Mùa bạn đang chơi" (không Phiên bản luật), mặc định `defaultSourceSeasonId`, nhớ qua `?season=`.
2. Ứng viên = đội chuẩn của mùa chọn (Recommended generation đang pin, category 交戰).
3. Mùa thiếu → lấp bằng `teams.json` cũ, nhãn "Tham khảo – đội cũ", luôn xếp sau.
4. Giữ bất biến: không trùng tướng/chiến pháp, giữ đội đã xây, Meta / Nhiều hột.
5. Mục Thiếu món: thiếu tướng → "Tôi có tướng này"; thiếu chiến pháp → "Tôi có chiến pháp này"
   + món bù từ dữ liệu cùng mùa có trong kho; chọn bù → đội vào portfolio nhãn "đã thay".
6. "Vì sao?" chỉ gọi khi bấm → Worker mode `explainSubstitute`; LLM không chọn/đề xuất món.
7. `/zh/` tương đương, qua pipeline localization.

**Out of scope:** thay tướng; LLM chọn đội; Phiên bản luật; `/soi-doi-tu-anh/`; luồng scan ảnh;
khôi phục `projectSeasonCandidates` / scope `season-context`.

## Evidence (generation 72c964…, re-measure on the pinned one)
- 1366 cấu hình / 26 mùa; ánh xạ tướng qua `nameRaw` → heroes-dict (`chinese`/`aliases`) đạt 98.1%
  cấu hình (qua `displayNameVi` chỉ ~97.7%: `SP Hoàng Phổ Tung` ≠ `SP Hoàng Phủ Tung`).
- Ô chiến pháp: 8196; `—`/rỗng = ô trống; 19 ô raw không có trong tactics.json → ô có điều kiện, không tính thiếu.
- `alternativeHoldersRaw` chỉ 5 cấu hình; `legacyReferences` rỗng toàn bộ → dedupe đội cũ theo tập 3 tướng.

## Phases
| # | Phase | Status |
|---|-------|--------|
| 1 | [Season candidate adapter (TDD)](./phase-01-season-candidate-adapter.md) | Pending |
| 2 | [Engine: fallback, overrides, substitutes (TDD)](./phase-02-engine-fallback-substitutes.md) | Pending |
| 3 | [Worker mode explainSubstitute (TDD)](./phase-03-worker-explain-substitute.md) | Pending |
| 4 | [UI: season select, Thiếu món, Vì sao?](./phase-04-roster-ui.md) | Pending |
| 5 | [Localization, e2e, docs, cleanup](./phase-05-localization-e2e-docs.md) | Pending |

## Validation gates
- `npm run test:node`; `cd worker && npm test && npm run typecheck`; `python3 -m unittest discover -s tests`
- `node scripts/design-tokens.mjs --check`; `npm run build` + verify; targeted Playwright specs
- `npm run generate:workflow-build` (engine là semantic file của mcp-worker)
- Localization: sha256 re-pin trong `sourceFiles`, build→check→publish→check public, re-pin `team-route-handles.json`

## Stop and ask only if
- Tỉ lệ cấu hình ánh xạ được < 98% mà không giải thích được.
- Cần sửa dữ liệu nguồn Recommended (không chỉ publish lại).
- Triển khai Worker production / secrets.
