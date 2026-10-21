---
phase: 2
title: "Redirect 301 sinh từ ledger"
status: pending
priority: P1
effort: "4h"
dependencies: [1]
---

# Phase 2 — Redirect 301 sinh từ ledger (PR-A)

<!-- Updated: Red Team 2026-10-20 - đếm rule từ dữ liệu, bỏ 3 nhánh lỗi chết và test JS trùng, sửa make_data, kiểm bằng wrangler pages dev trước merge, thêm deployment-guide -->

## Mục tiêu
`public/_redirects` chứa đúng 2 rule 301 cho mỗi cặp (mã cũ → mã giữ) trong `formerIds` (hiện 18 cặp → 36 rule, `/tra-cuu/` và `/zh/tra-cuu/`), sinh và kiểm bởi `pipeline/lookup_route_handles.py`, đi vào `dist/` qua verifier; 8 chiến pháp bỏ hẳn và Hà Thị vẫn 404. Redirect được kiểm thật trên máy trước khi lên production.

## Bằng chứng
- `pipeline/lookup_route_handles.py`: `load_corpus :81-111` (giữ `(id, name)` ở `:96`), `ledger_bytes :164`, `write_ledger :220-244` (ghi `:242`), `check_ledger :247-254`, CLI `:257-271`; validator ledger đã bắt slug trùng giữa sống/đã gỡ (`:200-210`), slug theo `SLUG_SHAPE`.
- `retired.tactics` 26 = 18 gộp + 8 bỏ hẳn (`dao-vien-ket-nghia`, `doan-trang-tri-trong`, `duy-noi-thien-quyen`, `khien-che`, `thien-ly-quy-luong`, `thuy-hue-van-vat`, `tuyet-ke-chiet-muu`, `van-quan-thu-tuong`).
- `scripts/verify-astro-dist.mjs:31-33` chỉ có `_headers`; `:658-666` so byte; `:292-298` chặn file lạ/thiếu.
- `tests/test_lookup_route_handles.py:34` fixture `tactics.json` không có `lookup` → đọc `formerIds` nghiêm ngặt sẽ làm `main` trả 1 (`:269` bắt `KeyError`).
- Slug nhóm zh = vi (`js/lookup-ids.js:231-240`); URL chi tiết có `/` cuối (`src/lib/lookup-detail-routes.ts:32`).
- `public/_headers` `/tra-cuu/*`, `/zh/*`: `max-age=0, must-revalidate` → không lo 404 cũ bị cache; rủi ro thật là 301 bị trình duyệt cache lâu dài.

## File
- Sửa: `pipeline/lookup_route_handles.py`
- Tạo: `public/_redirects` (sinh ra, commit)
- Sửa: `scripts/verify-astro-dist.mjs`
- Sửa: `tests/test_lookup_route_handles.py`
- Sửa: `tests-js/astro-dist-contract.test.mjs`
- Sửa: `docs/unified-lookup.md` (route handles: `_redirects` là đầu ra)
- Sửa: `docs/deployment-guide.md` (`:44` danh sách contract test/allowlist dist, `:98` `data/` và `_headers` → thêm `_redirects`, `:106-114` lệnh route handles và câu "mã không còn trong corpus trả 404 tĩnh" → mã gộp 301, mã bỏ hẳn 404)

## Thiết kế
- `DEFAULT_REDIRECTS_PATH = REPO_ROOT / "public" / "_redirects"`; CLI thêm `--redirects PATH`.
- `former_owner_map(data_dir) -> {retired_id: survivor_id}` đọc `data_dir/tactics.json` `lookup.formerIds` (nghiêm ngặt: thiếu `lookup`/`formerIds` là lỗi dữ liệu).
- `redirects_bytes(former_map, ledger) -> bytes`:
  - Với mỗi `(retired_id, survivor_id)` sắp theo `retired_id`: `old = ledger.retired.tactics[retired_id]`, `new = ledger.handles.tactics[survivor_id]`.
  - Dòng: `/tra-cuu/chien-phap/{old}/ /tra-cuu/chien-phap/{new}/ 301` và `/zh/tra-cuu/chien-phap/{old}/ /zh/tra-cuu/chien-phap/{new}/ 301`.
  - Đầu file: `# Sinh bởi python3 -m pipeline.lookup_route_handles --write; không sửa tay.`; kết thúc `\n`.
  - Chỉ hai lỗi riêng (`LookupRouteHandleError`): retired id không có trong `ledger.retired.tactics`; survivor không có trong `ledger.handles.tactics`. Trùng slug/chuỗi đã do validator ledger bảo đảm.
- `write_ledger`: sau ghi ledger, ghi `_redirects` (write-if-different) từ ledger vừa cập nhật. `check_ledger`: so byte, sai → `public/_redirects is stale; run --write`.
- Verifier: thêm `Object.freeze({ sourcePath: "public/_redirects", outputPath: "_redirects" })` vào `DEPLOYMENT_CONTROL_ARTIFACTS`; không nới allowlist khác.

## Các bước
1. Test trước (`tests/test_lookup_route_handles.py`):
   - `make_data`: mọi dòng tactic có `lookup.formerIds` (mặc định `[]`); thêm một survivor có `formerIds` và retired id tương ứng; `run_cli` truyền `--redirects` vào tempdir.
   - Ca: mỗi cặp gộp sinh đúng 2 dòng (vi + zh); retired id không có survivor → không có dòng; survivor thiếu handle → exit 1; `--check` báo stale khi file bị sửa.
   - `RealLedgerTest`: `public/_redirects` byte-bằng `redirects_bytes` trên dữ liệu thật; số rule = `2 × số cặp formerIds` (tính từ `data/tactics.json`, không ghi 36).
2. Cài đặt emitter + CLI.
3. Trong `~/w2`: `python3 -m pipeline.lookup_route_handles --write` → commit `public/_redirects`; `--check` pass; ghi số rule thực (kỳ vọng 36) vào body PR-A.
4. Verifier + 6 fixture `tests-js/astro-dist-contract.test.mjs` (`:626/628, :688/689, :1164/1165, :1208/1209, :1394/1395, :1445/1446`) ghi thêm `_redirects` ở `public/` và `dist/`; test real-dist `:877-889` thêm 2 assert cho `_redirects`.
5. Kiểm thật trên máy (trước merge): `npm run build`, rồi `npx --prefix community-worker wrangler pages dev dist --port 8788` (wrangler đã ghim trong `community-worker`), chạy ma trận ở phase 07 bước 4 với `BASE=http://127.0.0.1:8788`: mọi nguồn `301` + `location` khớp chính xác (bỏ `\r`), đích `200`, 18 URL mồ côi `404`.
6. Docs: `docs/unified-lookup.md`, `docs/deployment-guide.md`.
7. PR-A `feat/redirect-301` → gate → merge → deploy Pages ngay (`gh workflow run pages-deploy.yml --ref main`; quyết định Validation 2026-10-20) → chạy ma trận phase 07 bước 4 trên `https://tqccl.com`, `fail=0`; ghi kết quả vào `docs/deployment.md` (mục Pages riêng cho PR-A).

## Todo
- [ ] Test Python (đỏ trước), `make_data` có `lookup.formerIds`
- [ ] Emitter + `--redirects` + check stale
- [ ] Sinh `public/_redirects`
- [ ] Verifier + fixture + real-dist assert
- [ ] Kiểm `wrangler pages dev`
- [ ] Docs + PR-A merge
- [ ] Deploy Pages sau PR-A, ma trận HTTP `fail=0`, ghi `docs/deployment.md`

## Kiểm tra
- `python3 -m unittest tests.test_lookup_route_handles -v` pass.
- `python3 -m pipeline.lookup_route_handles --check` pass.
- `npm run build && npm run verify && npm run test:dist` pass; `cmp public/_redirects dist/_redirects`.
- Ma trận `wrangler pages dev`: 100% đúng.

## Rủi ro
- 301 bị trình duyệt/Google cache lâu: sai đích thì sửa xong vẫn còn ở client. Vì vậy bước 5 là bắt buộc trước merge.
- Nếu một mã đã gỡ quay lại corpus (ledger trả lại slug cũ, `lookup_route_handles.py:10-12, :122-125`), rule bị bỏ khi `--write`; người đã cache 301 sẽ không vào được trang khôi phục cho tới khi cache hết — chi phí chấp nhận, ghi trong docs.
- Phase 06 promote đổi `generationId` → phải `--write` lại; `--check` sau đó bắt buộc.
