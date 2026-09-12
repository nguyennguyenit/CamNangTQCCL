---
title: "Phase 1: Start"
status: completed
---

# Nền dữ liệu kịch bản và phiên bản luật

## Overview

Trạng thái 2026-09-12: hoàn thành registry/evidence và checkpoint local; [validation](reports/phase-01-validation.md), [final gates](reports/final-validation.md). Một kịch bản VN, không có ruleset reviewed. Các baseline bên dưới là lịch sử trước implementation. Scenario-only reference đã được Kongming chốt trong [quyết định thực thi](reports/execution-decisions.md).

Đọc `README.md`, `docs/system-architecture.md`, ba artifact teams/team-tier/coexist và hợp đồng snapshot MCP. `source` là nguồn biên tập, không phải thời gian áp dụng. Phase này độc lập catalog nguồn.

Tạo curate `pipeline/season-registry.json`, `pipeline/season-evidence.json`, builder stdlib `pipeline/build_season_data.py`, và hai mảng output cùng tên trong `data/`. Cùng lát cắt tạo hai output, thêm đúng hai entry vào `src/lib/public-artifact-manifest.mjs` và cập nhật asset contract tests; không đợi phase 3. Không gọi `build_json` hay rewrite corpus hiện hành.

```text
scenario={id,labelVi,aliases[],region:"VN",kind:"introductory"|"scenario",
 rulesets:[{id,label,reviewStatus:"pending"|"reviewed",evidenceRefs[]}],
 sourceMappings:[{sourceSeason,provenance,rulesetId:null|string,
                  reviewStatus,evidenceRefs[]}],reviewStatus}
evidence={id,provenance,sourceSeason?,canonicalRef:null|{kind,id},note}
```

Scenario ID ổn định; ruleset là phiên bản cơ chế/balance theo vùng. Chơi lại cùng kịch bản không tạo scenario mới; luật đổi thêm ruleset. `sourceSeason.number` không phải khóa VN; ngày crawl không chứng minh hiệu lực. Không xuất HTML/cache nguồn.

## Requirements

- [x] Registry có schema/version, ID ổn định, evidence và trạng thái review rõ.
- [x] Chưa xác minh giữ null/pending, không tự map mùa theo số hoặc tên giống nhau.

## Implementation Steps

### TDD — Red → Green → Refactor

- [x] Red: viết/chạy `tests/test_build_season_data.py` trước builder: duplicate ID, cross-ref sai, pending không thành reviewed, cùng số mùa khác vùng không tự map, byte parity và corpus cũ bất biến.
- [x] Green: triển khai validator/builder theo từng case; inventory thiếu evidence vẫn pending/null.
- [x] Refactor: chạy lại focused Python tests, ghi bằng chứng vào báo cáo validation của plan.

### Triển khai theo từng lát cắt

1. Tách sheet gid190730430/Binh Diễn Xuân Thu (user-confirmed scenario, ruleset unknown) và legacy (scenario/ruleset unknown), không merge label hoặc đoán luật. Khóa snapshot/hash từ source research, evidence xác nhận scenario riêng evidence luật. Lập `reports/season-mapping-inventory.md` trong thư mục kế hoạch: nhãn nguồn, vùng, scenario/ruleset đề xuất, bằng chứng, điểm chưa biết, trạng thái review.
2. Viết validator/build deterministic và test duplicate ID, cross-ref sai, pending bị dùng như reviewed, source cùng số mùa khác vùng.
3. Test candidate output trong thư mục tạm trước khi promote. Khi tạo file thật trong `data/`, cập nhật manifest cùng thay đổi; kiểm exact source inventory, byte parity và Astro build. `src/lib/root-static-artifacts.ts` tiếp tục reject entry lạ, chỉ giữ ngoại lệ private `data/sgsdeck/` hiện có. Chưa thêm ba sidecar phase 2 hoặc entry trỏ file chưa tồn tại.

## Todo

- [x] Tạo builder và `tests/test_build_season_data.py`.
- [x] Chạy `python3 -m unittest tests.test_build_season_data`, kiểm byte parity hai lần build và corpus cũ không đổi.
- [x] Red asset contract: thêm sidecar mà thiếu manifest phải reject; Green thêm đúng hai entries cùng outputs. Chạy `npm run build`, `npm run test:dist`, `npm run verify` và `npm run test:node` trước hoàn thành phase; không bỏ qua failure với lý do phase 3 sẽ sửa sau.

## Success Criteria

Registry và inventory phân biệt điều xác minh được với unknown, không cần bịa đủ mùa. Chỉ pair reviewed tạo seasonContext có hiệu lực. Scenario attribution được xác nhận có thể tồn tại với ruleset null để reference browse (đã chốt bởi Kongming); không cấp gameplay applicability. Checkpoint phase 1 có đúng hai public sidecar đã khai báo và build/regression đạt. Sau checkpoint này, UI/MCP được triển khai trong phase 3/4.

## Rủi ro và rollback

Tên kịch bản giống chưa chứng minh luật giống. Rollback hai output cùng entries manifest tương ứng để exact inventory vẫn hợp lệ; không sửa ID/hash lịch sử hoặc nới source-tree validator.


## Deep inventory, interfaces và test matrix

| Files | Action |
|---|---|
| `pipeline/season-registry.json`, `pipeline/season-evidence.json` | Tạo curated inputs |
| `pipeline/build_season_data.py`, `tests/test_build_season_data.py` | Tạo deterministic validator/builder, tests trước code |
| `data/season-registry.json`, `data/season-evidence.json` | Hai output mới; corpus legacy bất biến |
| `src/lib/public-artifact-manifest.mjs`, `tests-js/astro-dist-contract.test.mjs`, `tests-js/runtime-asset-contract.test.mjs` | Sửa cùng lần tạo hai output; contract checkpoint và private boundary |
| `src/lib/root-static-artifacts.ts`, `scripts/verify-astro-dist.mjs` | Đọc và giữ exact allowlist; không nới validator |
| README, architecture, artifact-contracts và corpus trong [owner inventory](reports/coexist-owner-verification.md) | Đọc contracts hiện có |
| `reports/season-mapping-inventory.md`, `reports/validation.md` trong plan | Evidence/actual test counts |

Dependency: snapshot/confirmation → registry/evidence → phase 2 → consumers phase 3/4. Không cần catalog hoàn tất.
Interface checklist:
- [x] Registry unique IDs/evidence refs.
- [x] Nullable source mapping.
- [x] Attribution khác applicability.
- [x] Candidate validation trước publish.
- [x] Deterministic bytes và rollback; rollback khi replace lỗi được hoàn thiện/kiểm chứng ở phase 2.

| Red case | Green invariant |
|---|---|
| Duplicate/dangling refs, pending thành reviewed | Reject |
| Confirmed scenario, null ruleset | Lưu attribution; không tạo effective context |
| Cùng số mùa khác vùng / label trùng nguồn | Không auto-map/merge |
| Nguồn mới + legacy unknown | Legacy không đổi scope/bytes |
| Repeat offline / invalid candidate | Parity / accepted outputs giữ nguyên |
| Output mới thiếu manifest / manifest trỏ file thiếu | Reject; chỉ promote output và entry cùng checkpoint |
| Phase 1 với đúng hai sidecar / private SGSDeck | Build và dist pass; catalog không xuất public |

Baseline: suite season builder chưa tồn tại. Integration research ghi 9 test declarations artifact-contracts, không phải test pass. Chạy test đã viết trước builder: `python3 -m unittest tests.test_build_season_data -v`; Green/Refactor rồi `python3 -m unittest discover -s tests`. Lỗi thiếu module trước khi có test không là Red hợp lệ. Ghi actual counts trong validation.
