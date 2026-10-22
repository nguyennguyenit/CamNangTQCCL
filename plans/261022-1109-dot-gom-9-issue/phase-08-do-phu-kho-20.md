---
phase: 8
title: "Độ phủ kho theo tier (#20)"
status: done
priority: P2
effort: "1.5d"
dependencies: [7]
---

# Phase 8: Độ phủ kho theo tier (#20)

## Goal

`/goi-y-doi-tu-kho/` có khối "Độ phủ kho" cho mùa đang chọn: theo từng tier, số đội ráp đủ khi đứng riêng, số đội thiếu đúng 1 món, tổng số đội; bấm ô mở danh sách đội; tiến độ sưu tầm tướng/chiến pháp so với Đội chuẩn của mùa. Có bản zh, theme sáng/tối, mobile.

## Hiện trạng (bằng chứng: [reports/scout-05-20-roster.md](./reports/scout-05-20-roster.md) mục 3–4)

- `buildSeasonCandidates` (`js/roster-season-candidates.js:55-91`) trả `{teams, teamTier, diagnostics{total, mapped, unmapped[]}}`; mỗi đội có `heroes[{name, tactics[{name, alternatives[], unresolved?}]}]`, `conditionalTactics[]`.
- `recommendRoster` không dùng được cho độ phủ: lọc tier meta (`team-recommend-engine.js:183-190`), dừng ở tướng thiếu đầu tiên (`:709-721`), áp ràng buộc dùng chung (issue loại trừ).
- `SOURCE_TIER_ORDER = ['T0','T0.5','T1','T1.5','T2','T3','FUNC','功能隊']` (`js/recommended-reference-state.js:190`).
- Mùa `pk-s15`, `pk-s20`, `pk-s21` có 0 đội; `pk-s26` có 17 cấu hình chưa map, `pk-s24` có 2.
- Hiện không đội nào có phương án thay trong dữ liệu; phương án thay chỉ đến từ món bù người dùng (`applyTacticOverrides`, `:114-137`).
- UI giữ `season = {id, teams, teamTier, usage}` (`js/roster-recommend-ui.js:143-161`).

## Thiết kế

- Hàm thuần `js/roster-coverage.js` (không DOM, không nằm trong `semanticFiles`):
  `buildRosterCoverage({seasonTeams, seasonTier, ownedHeroes, ownedTactics, tacticIdOf}) → {tiers:[{tier, total, complete:[team], missingOne:[{team, missing:{kind, name}}]}], progress:{heroes:{owned,total}, tactics:{owned,total}}, unmapped}`.
  - So khớp bằng id: `canonicalHeroId`/`normalizeHeroSlot` (`js/hero-identity.js`), `createTacticIdResolver` (`js/lookup-ids.js`), cùng resolver với engine.
  - Ô tướng `"A/B"` tính là có nếu có một trong hai; ô chiến pháp có phương án thay (kể cả món bù người dùng) tính là có nếu có một phương án.
  - Bỏ qua `conditionalTactics` và ô rỗng/bond.
  - Đội có ô `unresolved`: không tính "ráp đủ"; nếu mọi ô khác đã có thì tính "thiếu 1" với món là ô chưa đối chiếu, ghi nhãn "chưa đối chiếu". <!-- Updated: Validation Session 1 - chốt "thiếu 1" -->
  - Mỗi đội tính độc lập, không ràng buộc dùng chung.
  - Tiến độ: tập id tướng/chiến pháp trong kho (khử trùng) giao với tập xuất hiện trong Đội chuẩn của mùa, trên tổng tập của mùa; bỏ ô `unresolved`.
- Khối đặt ở bước kết quả, trước mục danh mục. <!-- Updated: Validation Session 1 - chốt bước kết quả --> Bảng tier × (ráp đủ / thiếu 1 / tổng); bấm ô mở danh sách; đội thiếu 1 ghi rõ món thiếu và nút dẫn tới luồng "Tôi có…". Mùa 0 đội: trạng thái rỗng. Mùa có cấu hình chưa map: ghi chú "N cấu hình chưa đối chiếu, không tính".

## Files to Create / Modify

- Create: `js/roster-coverage.js`; thêm `entry("js","roster-coverage")` vào `src/lib/public-artifact-manifest.mjs`.
- Modify: `js/roster-recommend-ui.js` (ghim), `css/styles.css`.
- Create: `tests-js/roster-coverage.test.mjs`. Modify: `tests-e2e/beta-tools.spec.mjs`.
- Publish lại bản dịch, re-pin `pipeline/team-route-handles.json`.
- Docs (issue yêu cầu): `README.md` (Gợi ý đội), `docs/codebase-summary.md`, `docs/project-changelog.md`.

## TDD (đỏ trước)

`tests-js/roster-coverage.test.mjs`:

1. Ranh giới trong một đội: thiếu 0 → ráp đủ; thiếu 1 → thiếu 1; thiếu 2 → không vào hai nhóm.
2. Thiếu 1 tướng + 1 chiến pháp không phải "thiếu 1".
3. Ô tướng `"A/B"`: có A hoặc B là có.
4. Ô chiến pháp có món bù người dùng: có món bù là có.
5. Ô `unresolved`, các ô khác đã có: đội không "ráp đủ", nằm trong "thiếu 1" với món thiếu là ô chưa đối chiếu.
6. Ô rỗng và `conditionalTactics` bị bỏ qua.
7. Một tướng dùng ở nhiều đội: mỗi đội tính riêng.
8. Thứ tự tier theo `SOURCE_TIER_ORDER`; tier lạ xếp cuối.
9. Mùa 0 đội (`pk-s20`): cấu trúc rỗng, không ném lỗi.
10. Tiến độ: món trùng trong kho không đếm hai lần; món không có trong mùa không làm tăng tử số.
11. Dữ liệu thật, kho của issue #5, mùa `og-兵演春秋`: tổng 25 (T0 12, T0.5 1, T1 12); Lữ Bố Cung và Ngô Nữ Kỵ đều "ráp đủ" khi đứng riêng.
12. Kho lưu tên Hán-Việt cũ của chiến pháp vẫn ra cùng id với engine.

E2E:

13. Kho của issue, `/goi-y-doi-tu-kho/?season=og-兵演春秋` (ghim mùa): bảng đúng số; bấm ô "ráp đủ" T0 liệt kê đội; ô "thiếu 1" ghi món thiếu và có link "Tôi có…".
14. Đổi `?season=pk-s20`: trạng thái rỗng.
15. zh, theme tối, mobile 390px không tràn ngang.

## Verification

```
node --test tests-js/roster-coverage.test.mjs
<chuỗi Publish lại bản dịch hiển thị>
python3 -m pipeline.team_route_handles --check
npm run build && npm run verify && npm run test:dist && npm run test:node
npx playwright test tests-e2e/beta-tools.spec.mjs -g "Gợi ý đội"
```

## Risks

- Đặt hàm vào `roster-season-candidates.js` hay `team-recommend-engine.js` sẽ đổi hash workflow MCP: không làm.
- Rebase lên phase 7 trước khi publish lại bản dịch, vì cùng sửa `js/roster-recommend-ui.js`.
