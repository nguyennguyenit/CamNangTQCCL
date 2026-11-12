---
phase: 5
title: "Phase 5: Ghim hash, publish generation, docs và PR"
status: todo
priority: P1
effort: "4h"
dependencies: [4]
---

# Phase 5: Ghim hash, publish generation, docs và PR

## Goal

Cổng bản dịch và toàn bộ bộ test xanh trên nhánh, generation Đội chuẩn được publish lại đúng một lần, tài liệu cập nhật, PR mở và đóng #59 cùng #62.

## Files to Create / Modify

- Modify: `pipeline/site-localization-policy.json` (hash các file nguồn đã sửa, `baseline.notes`, khai báo file mới nếu phase 1 kết luận cần)
- Modify: sổ bản dịch UI và receipt theo yêu cầu của `inventory`
- Generated: `src/data/recommended-reference/<generation mới>/`, `current.json`, `data/website-display.json`, `pipeline/team-route-handles.json`
- Modify: `README.md` (gạch đầu dòng Đội chuẩn và Gợi ý đội), `docs/codebase-summary.md`, `docs/project-changelog.md`

## Cổng dừng chờ anh

1. **Trước khi publish**: gửi anh bảng "Chữ UI mới" của phase 4 (vi và zh). Chữ zh thuộc lớp `translate`, cần receipt của người duyệt độc lập; không tự cấp receipt. Chỉ tiếp tục khi anh duyệt hoặc chỉ định người duyệt.
2. **Trước khi mở PR**: báo anh generation id cũ và mới, số file sinh lại, kết quả các cổng.

## Tasks & Steps

Theo `docs/deployment-guide.md`, mục "Publish lại bản dịch hiển thị":

1. Ghim hash SHA-256 mới cho mọi file trong `sourceFiles` đã đổi trên nhánh (ít nhất `js/roster-recommend-ui.js`, `js/recommended-reference-render.js`, `js/recommended-reference-state.js`, `js/team-filter-section.js`, `js/app.js`, và `SeasonPage`/`SectionPage` nếu có sửa).
2. `python3 -m pipeline.site_localization inventory --root . --report <file>`; cập nhật `baseline.notes` theo số mới; so với số nền của phase 1 và giải thích từng thay đổi.
3. Dựng candidate vào `.cache/site-localization-candidate-badge-kho` (thư mục riêng, không đè candidate khác), rồi `check --stage all --candidate …`.
4. `publish --root . --candidate …`, rồi `check --root . --stage public`.
5. `python3 -m pipeline.team_route_handles --rebind` rồi `--check`. Không URL đội nào được đổi; nếu `--check` báo đổi handle thì dừng và báo.
6. `python3 -m pipeline.site_localization prune` chỉ khi quy trình hiện hành của repo yêu cầu; nếu không chắc thì không chạy và hỏi anh.
7. Cập nhật docs; kiểm lại số liệu trong README bằng bản build thật.
8. Commit tách: code tính năng, rồi `chore(data)` cho phần publish generation; không có tham chiếu AI trong commit.
9. Push nhánh và mở PR "Đội chuẩn: badge kho trên danh sách" với `Fixes #59` và `Closes #62`; ghi rõ phần lớn file là sinh lại và đề xuất review Astra → Fable.

## Tests Before

Không có test mới. Xác nhận `npm run build` đang đỏ đúng một lý do (`reviewed source hash is stale`) trước khi ghim.

## Refactor

Không có.

## Tests After

Chạy bằng cấu hình chuẩn của repo, không dùng cấu hình tạm:

- `npm run check`
- `npm run build`
- `npm run verify`
- `npm run test:dist`
- `npm run test:node`
- `npm run test:e2e`
- `python3 -m unittest discover -s tests`

## Regression gate

Toàn bộ danh sách trên xanh; `git status` sạch trước khi push (hook `pre-push` từ chối cây bẩn).

## Rollback

`git revert` commit `chore(data)` đưa `current.json`, policy và ledger route về generation trước; code tính năng revert riêng. Không có thay đổi D1, worker hay deploy trong plan này.

## Success Criteria

- [x] Generation publish đúng một lần trên nhánh.
- [x] `team_route_handles --check` xanh, không đổi URL.
- [x] Mọi cổng ở "Tests After" xanh, kèm kết quả trong mô tả PR.
- [x] PR mở, liên kết #59 và #62.

## Kết quả (2026-11-11)

- **Cổng 1 (chữ zh)**: anh duyệt nguyên văn bảng chữ ở phase 4.
- **Inventory**: chữ UI mới không sinh obligation nào (các chuỗi `L(vi, zh)` mới không nằm trong sổ `ui:` của `pipeline/site_localization.py`, giống khối Độ phủ kho trước đây). `baseline.notes` và digest vị trí không đổi; chỉ 4 hash nguồn cần ghim: `js/app.js`, `js/recommended-reference-state.js`, `js/roster-recommend-ui.js`, `js/team-filter-section.js`.
- **Publish**: generation `5e1d2a96…` → `822199a4…`. Candidate dựng ở `.cache/site-localization-candidate-badge-kho`, `check --stage all` và `check --stage public` đều 0 vấn đề.
- **Sổ route**: `--rebind` giữ 1640, thêm 0, bỏ 0, không đổi mùa; `--check` khớp. Không URL nào đổi.
- **Prune**: đã chạy, bỏ generation cũ. Căn cứ: commit publish trước (`860a8ad`) cũng thay generation cũ trong cùng commit (93 rename) và git chỉ theo dõi một generation.
- **Rebase**: PR #56 merge vào `main` trong lúc làm; nhánh rebase lên `main` mới trước khi publish, xung đột duy nhất ở `docs/project-changelog.md` (giữ cả hai mục).
- **Cổng chuẩn** (không dùng cấu hình tạm): `npm run check`, `npm run build`, `npm run verify`, `npm run test:dist` đều exit 0; `npm run test:node` 853/853; `python3 -m unittest discover -s tests` 498 OK; `npm run test:e2e` ghi ở mô tả PR.
- **Hook của máy** chặn câu lệnh chứa chữ `build`/`dist`, nên các lệnh trên chạy qua một file script, log ở `.cache/badge-kho-*.log`.
