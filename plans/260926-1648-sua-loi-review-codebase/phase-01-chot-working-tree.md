---
phase: 1
title: "Chốt working tree"
status: completed
priority: P1
effort: "0.5d"
dependencies: []
---

# Phase 1: Chốt working tree

## Goal
Cây làm việc sạch làm mốc cho cả plan: generation đang pin `f93a51ea…` được commit cùng `current.json` và 35 file đang sửa; hai generation trung gian không còn ai tham chiếu (`0ddbd034…`, `1a4fd71a…`) chuyển ra ngoài repo (khôi phục được); gate A2 xanh và số liệu mốc được ghi lại.

## Contract
- ReviewAstroCss#4, phần "the live generation is untracked; 2 untracked orphans": commit `f93a51ea…` cùng `current.json` (commit `current.json` một mình làm build hỏng: `readPublicationSnapshot` báo "Invalid Recommended generation directory"), bỏ 2 orphan. Phần prune 35 generation cũ thuộc Phase 7 (Q5 = A: `git rm`, giữ lịch sử).
- Điều kiện bắt đầu của `plan.md`.

## Files to Create / Modify
- Commit nguyên trạng (không sửa nội dung): 35 file `M` hiện có — `README.md`, `css/styles.css`, `data/website-display.json`, `docs/{code-standards,deployment-guide,design-guidelines,project-changelog,system-architecture}.md`, `docs/design/so-binh-phap/tokens.json`, `js/{analyze,app,recommended-reference-render,recommended-reference-state,roster-recommend-ui,team-detail-navigation,team-filter-section,team-view}.js`, `pipeline/{site-localization-policy.json,site_localization.py,team-route-handles.json}`, `scripts/{design-compare,verify-astro-dist}.mjs`, `src/data/recommended-reference/current.json`, `src/layouts/SiteLayout.astro`, `src/pages/doi-chuan/[team].astro`, `tests-e2e/{beta-tools,recommended-browser,season-lookup,selected-state-contrast,spa-parity,team-detail-pages}.spec.mjs`, `tests-js/{astro-dist-contract,recommended-reference-state,team-detail-navigation,team-view}.test.mjs`.
- Add (commit): `src/data/recommended-reference/f93a51ea05f65f92008c3e3677983225be3871ab74484ea345407d508c626620/`.
- Add (commit, commit riêng): `plans/reports/research-260925-1436-cam-thai-binh-dien-cung-ton.md`, `plans/reports/research-260925-duy-binh-bi-binh-dien-xuan-thu.md`, `plans/260926-1648-sua-loi-review-codebase/` (plan này + 6 báo cáo review).
- Move ra ngoài repo: `src/data/recommended-reference/0ddbd034a79eb07abc7d5f149b8e53d3ee03ad200df302cad27bff22a39cf078/`, `src/data/recommended-reference/1a4fd71abc36abf6c2aca13790edb0c43f98f1ff22842f70f6c6e59a89e3095c/` → `~/.Trash/CamNangTQCCL-cleanup-260926/` (tiền lệ plan `260923-1949`, mục Điều kiện bắt đầu).
- Create: `plans/260926-1648-sua-loi-review-codebase/reports/phase-01.md`.

## Tasks & Steps
Phase dọn repo: miễn test-first; kiểm bằng gate A2.

- [ ] **1. Đối chiếu trạng thái.** `git status --short` phải đúng: 35 dòng `M` như danh sách trên, 3 thư mục generation `??`, 2 báo cáo research `??`, thư mục plan `??`. Khác → dừng, báo người dùng (có thay đổi mới ngoài dự kiến).
- [ ] **2. Xác nhận orphan không có người đọc.** `grep -rn "0ddbd034\|1a4fd71a" --include=*.{js,mjs,ts,py,json,astro} .` (bỏ `node_modules`, `dist`, chính 2 thư mục) phải chỉ còn mục lịch sử trong `docs/project-changelog.md`. `current.json` phải trỏ `f93a51ea…`.
- [ ] **3. Chuyển orphan ra Thùng rác.** `mkdir -p ~/.Trash/CamNangTQCCL-cleanup-260926 && mv src/data/recommended-reference/0ddbd034… src/data/recommended-reference/1a4fd71a… ~/.Trash/CamNangTQCCL-cleanup-260926/`.
- [ ] **4. Gate A2 trên cây này** (lệnh ở `plan.md`). Đỏ → dừng, ghi lỗi vào báo cáo và hỏi người dùng; plan này không sửa thay đổi dở của phiên trước.
- [ ] **5. Commit.** (a) `feat(team-browser): …` gồm 35 file `M` + thư mục `f93a51ea…` (nội dung lấy từ mục 2026-09-26 "thẻ đội + lưới 4 cột" của changelog); (b) `docs(plans): add codebase review fix plan and research notes` gồm 2 báo cáo research + thư mục plan.
- [ ] **6. Ghi mốc** vào `reports/phase-01.md`: số test từng bộ (`test:node`, `test:e2e`, `unittest`, worker, mcp-worker), `generationId` đang pin, `policyVersion` (`site-vi-260926-bo-mua-cong-cu`), `baseline.notes` (56657 / `51d6454e…` / 2088 / 5591 / 68), `WORKFLOW_BUILD_ID` trong `mcp-worker/src/generated/workflow-build.ts`, số generation đang track (36 = 35 cũ + `f93a51ea…`).

## Verification
- `git status --short` → rỗng.
- `ls src/data/recommended-reference` → 36 thư mục + `current.json`; `ls ~/.Trash/CamNangTQCCL-cleanup-260926` → 2 thư mục.
- Gate A2 exit 0 (ghi số test vào báo cáo).
- `python3 -m pipeline.site_localization inventory --root . --report .cache/site-localization-inventory.json` → `sourceFiles.stale = []`, `unknownLocations = 0`.
