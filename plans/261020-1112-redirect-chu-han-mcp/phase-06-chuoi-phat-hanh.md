---
phase: 6
title: "Chuỗi phát hành dữ liệu và gate"
status: pending
priority: P1
effort: "5h"
dependencies: [2, 4, 5]
---

# Phase 6 — Chuỗi phát hành dữ liệu và gate (PR-B)

<!-- Updated: Red Team 2026-10-20 - manifest paths [], bỏ build_recommended_reference, bỏ UI_LITERAL/inventory repin, commit sinh riêng + transaction id mới khi chạy lại, sửa danh sách file sinh (zh-gaps.md, bỏ books-dict), số đếm theo dữ liệu -->

## Mục tiêu
Từ đầu vào và code đã sửa, sinh bộ dữ liệu công khai nhất quán: Lookup promote, route ledger + `_redirects` theo generation mới, localization publish, team route pin, MCP workflow build; gate xanh trong `~/w2`; PR-B sẵn sàng merge.

## Bằng chứng
`docs/unified-lookup.md:73-148`, `docs/deployment-guide.md:251-293`, `pipeline/site_localization.py:2024-2029, 2059-2073, 2077-2138, 2192-2220`, `pipeline/promote_unified_lookup.py:21 (PUBLIC_DATA_FILES), 25, 186-206, 269-270, 376-381, 436`, `pipeline/build_unified_lookup.py:2134-2140`, `pipeline/site-localization-policy.json:761-833`, `pipeline/team_route_handles.py:501-502`, `scripts/report-zh-gaps.mjs:15`, `mcp-worker/workflow-source-manifest.json`. Tiền lệ `paths: []`: `plans/260913-2018-viet-hoa-toan-bo/phase-02-reviewed-publication.md:85`.

Kết luận đã chốt (không còn câu hỏi mở):
- Manifest activation: `{"schemaVersion":1,"paths":[]}` — code/config đến qua git; promote chỉ ghi 4 file `data/` + journal.
- `site_localization publish` đã dựng Recommended từ candidate (`:2108-2118`) → không chạy `build_recommended_reference` tay.
- Không đăng ký `UI_LITERAL_OBLIGATIONS` → không repin `concreteLocationCount`/`concreteInventorySha256`; chỉ repin `policy.sourceFiles`.
- Generator knowledge bundle không đọc dữ liệu chiến pháp (`mcp-worker/scripts/generate-knowledge-bundle.ts:21-23, 61-85`) → không sinh lại; `check:knowledge-bundle` vẫn chạy trong gate.

## File sinh (commit cuối riêng của PR-B)
- `data/tactics.json`, `data/heroes-dict.json`, `data/lookup-catalog.json`, `data/lookup-manifest.json` (promote)
- `pipeline/lookup-route-handles.json`, `public/_redirects`
- `pipeline/site-localization-policy.json` (repin `sourceFiles`), `data/website-display.json`, `src/data/recommended-reference/**` (publish)
- `pipeline/team-route-handles.json` (`generationId`)
- `plans/261015-1658-seo-ai-render-san/reports/zh-gaps.md` (`report-zh-gaps.mjs`)
- `mcp-worker/src/generated/workflow-build.ts`
- Không commit: `pipeline/lookup-output/**`, `.cache/**`.

## Các bước (trong `~/w2`, nhánh `feat/chu-han-nguon`, đã pull mọi commit code/dữ liệu đầu vào của phase 03–05; từ đây ngừng commit từ Windows)
1. **Candidate Lookup**:
   ```bash
   python3 -m pipeline.build_unified_lookup build --inputs pipeline/lookup-inputs --source data/sgsdeck --identity pipeline/lookup-identity.json --translations pipeline/lookup-translations.json --client-heroes pipeline/lookup-client-heroes.json --client-tactics pipeline/lookup-client-tactics.json --output pipeline/lookup-output/candidate
   python3 -m pipeline.build_unified_lookup validate --candidate pipeline/lookup-output/candidate
   ```
2. **Manifest activation**: `mkdir -p pipeline/lookup-output/chu-han-nguon-activation && printf '{"schemaVersion":1,"paths":[]}\n' > pipeline/lookup-output/chu-han-nguon-activation/activation-manifest.json`.
3. **Promote** (transaction id có hậu tố lần chạy; lần đầu `-r1`):
   ```bash
   TX=chu-han-nguon-261020-r1
   python3 -m pipeline.promote_unified_lookup promote --candidate pipeline/lookup-output/candidate --activation pipeline/lookup-output/chu-han-nguon-activation/activation-manifest.json --transaction "$TX" --root .
   ```
   Gián đoạn → `python3 -m pipeline.promote_unified_lookup recover --transaction "$TX" --root .`. Lỗi khác → điều kiện dừng; không xoá journal/lock, không tái dùng transaction id.
4. **Route ledger + redirect theo generation mới**:
   ```bash
   python3 -m pipeline.lookup_route_handles --write
   python3 -m pipeline.lookup_route_handles --check
   node scripts/report-zh-gaps.mjs && node scripts/report-zh-gaps.mjs --check
   ```
5. **Repin `policy.sourceFiles`** (sau lần sửa cuối của mọi file bị ghim): `sha256sum js/lookup-data.js js/lookup-detail.js js/lookup-profile.js js/lookup-tactic-profile.js js/unified-lookup.js src/lib/lookup-item-pages.ts` (cộng file khác đã sửa nếu có trong `:761-833`, ví dụ `js/lookup-tactic-view.js`) → cập nhật giá trị tương ứng.
6. **Localization candidate + publish**:
   ```bash
   python3 -m pipeline.site_localization build --root . --stage all --output .cache/site-localization-candidate
   python3 -m pipeline.site_localization check --root . --stage all --candidate .cache/site-localization-candidate
   python3 -m pipeline.site_localization publish --root . --candidate .cache/site-localization-candidate
   python3 -m pipeline.site_localization check --root . --stage public
   ```
   `prune` chỉ khi quy ước repo yêu cầu (`docs/deployment-guide.md:266`).
7. **Team route pin**: `pipeline/team-route-handles.json` `generationId` = `generationId` của `src/data/recommended-reference/current.json`; `python3 -m pipeline.team_route_handles --check`.
8. **MCP workflow build (cuối cùng)**: `npm --prefix mcp-worker run generate:workflow-build && npm --prefix mcp-worker run check:workflow-build`.
9. **Gate đầy đủ**:
   ```bash
   python3 -m unittest discover -s tests
   node --experimental-strip-types --test tests-js/*.test.mjs
   npm run build && npm run verify && npm run test:dist
   (cd mcp-worker && npm run check)
   python3 -m pipeline.lookup_route_handles --check
   python3 -m pipeline.team_route_handles --check
   python3 -m pipeline.site_localization check --root . --stage public
   node scripts/report-zh-gaps.mjs --check
   node scripts/design-tokens.mjs --check
   LD_LIBRARY_PATH=~/pwlibs/root/usr/lib/x86_64-linux-gnu npx playwright test
   ```
10. **Kiểm dữ liệu cuối**: 0 pending; số `effectZhSource != null` = số mục `zhEffects` = số dòng bảng `reports/nguon-chu-han.md`; `data/tactics.json` và `workflow-build.ts` không chứa `"ref"`, `"note"`, `viSha256`, `%TEMP%`, `C:\`, `/home/`.
11. **Commit**: toàn bộ file sinh ở mục trên thành **một commit cuối** `chore(data): publish lookup chu-han-nguon` từ `~/w2`; push; mở PR-B (body: schema, link bảng nguồn, lệnh đã chạy + số test).

## Khi `main` có commit mới trước khi merge PR-B
1. `git rebase origin/main` các commit code/đầu vào; **bỏ commit sinh** (`git rebase -i`, drop) thay vì giải xung đột trong file sinh.
2. Chạy lại bước 1–11 với transaction id mới (`-r2`, `-r3`…).

## Todo
- [ ] Candidate build/validate
- [ ] Manifest `paths: []` + promote (`-r1`)
- [ ] Route ledger + `_redirects` + `zh-gaps.md`
- [ ] Repin `sourceFiles`
- [ ] Localization build/check/publish
- [ ] Team route pin
- [ ] `generate:workflow-build`
- [ ] Gate đầy đủ, kiểm dữ liệu cuối
- [ ] Commit sinh riêng + PR-B

## Kiểm tra
- Mọi lệnh bước 9 pass; số liệu ghi vào PR-B.
- `data/lookup-manifest.json.generationId` = `pipeline/lookup-route-handles.json.generationId`.
- `pipeline/team-route-handles.json.generationId` = `src/data/recommended-reference/current.json.generationId`.

## Rủi ro
- Transaction đã commit không hoàn tác; chuyển khỏi nó cần activation mới (`docs/unified-lookup.md:128-132`).
- `site_localization build` chạy evidence gate trước: đỏ vì hash → repin đúng file rồi build lại, không bỏ gate.
