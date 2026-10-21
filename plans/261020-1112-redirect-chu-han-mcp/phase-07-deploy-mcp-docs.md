---
phase: 7
title: "Merge, deploy Pages, MCP #2, docs"
status: pending
priority: P1
effort: "3h"
dependencies: [6]
---

# Phase 7 — Merge, deploy Pages, MCP #2, docs

<!-- Updated: Red Team 2026-10-20 - đóng băng main + blog, SHA chung, so location chính xác, MCP chỉ trả kind, sửa rủi ro cache, docs commit cuối -->

## Mục tiêu
PR-B trên `main`; Pages và MCP production chạy cùng một SHA tại thời điểm phát hành; mọi URL redirect/mồ côi đúng mã HTTP; MCP trả `effectZhSource.kind`; deploy được ghi lại.

## Bằng chứng
- `pages-deploy.yml:7-9` (`repository_dispatch: blog-publish`), `:15-18` (`cancel-in-progress: true`), `:28-30` (build `main`), `:53` (`--commit-hash`).
- `mcp-worker.yml:4-24` (4 input), `:122-147` (`production_sha` = `GITHUB_SHA` = `origin/main`).
- Mẫu ghi deploy: `docs/deployment.md:23-28` (Pages), `:39-50, :62-66` (MCP).
- Điều kiện tiên quyết: MCP #1 đã xong (plan.md).

## File
- Sửa: `docs/deployment.md`, `docs/unified-lookup.md`, `docs/project-changelog.md`, `docs/deployment-guide.md` (nếu phase 02 chưa đủ)
- Sửa nếu có liệt kê khoá `profile.lookup`: `docs/mcp-research-server.md`

## Các bước
1. **Đóng băng**: báo người dùng/quản trị không merge vào `main` và không đăng/sửa bài blog cho tới bước 6. Không xác nhận được → điều kiện dừng.
2. Merge PR-B (PR gate xanh). `git fetch && MAIN_SHA=$(git rev-parse origin/main)`.
3. **Pages**: `gh workflow run pages-deploy.yml --ref main`; chờ xong; xác nhận commit hash của deployment = `MAIN_SHA`. Nếu `main` đã đổi → deploy lại Pages ở HEAD mới, cập nhật `MAIN_SHA`, lặp tới khi khớp.
4. **Ma trận HTTP** (`BASE=https://tqccl.com`; cùng script dùng cho `wrangler pages dev` ở phase 02):
   ```bash
   BASE=${BASE:-https://tqccl.com}; fail=0
   while read -r src dst code; do
     [ "$code" = 301 ] || continue
     h=$(curl -sI "$BASE$src" | tr -d '\r')
     st=$(echo "$h" | awk 'NR==1{print $2}'); loc=$(echo "$h" | awk 'tolower($1)=="location:"{print $2}')
     loc=${loc#"$BASE"}
     d=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$dst")
     [ "$st" = 301 ] && [ "$loc" = "$dst" ] && [ "$d" = 200 ] || { echo "FAIL $src -> $st $loc ($dst $d)"; fail=1; }
   done < <(grep -v '^#' public/_redirects)
   for s in dao-vien-ket-nghia doan-trang-tri-trong duy-noi-thien-quyen khien-che thien-ly-quy-luong thuy-hue-van-vat tuyet-ke-chiet-muu van-quan-thu-tuong; do
     for p in "" /zh; do c=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$p/tra-cuu/chien-phap/$s/"); [ "$c" = 404 ] || { echo "FAIL $p/$s $c"; fail=1; }; done
   done
   for p in "" /zh; do c=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$p/tra-cuu/tuong/ha-thi/"); [ "$c" = 404 ] || { echo "FAIL $p/ha-thi $c"; fail=1; }; done
   echo "fail=$fail"
   # Biến thể không "/": ghi kết quả 2 nguồn mẫu, không tính vào tiêu chí
   ```
   `fail=1` → điều kiện dừng (có thể do Redirect Rule ở zone; không sửa ngoài repo khi chưa hỏi).
5. **Trang mẫu**: `curl -s` `/tra-cuu/chien-phap/<id translation>/` và `/zh/...`: có `data-zh-source="translation"`; `/zh/tra-cuu/chien-phap/` có cờ ở hàng mục translation; meta description zh của mục translation không chứa đoạn hiệu ứng; một mục `source` và một `capture` không có cờ.
6. **MCP #2**: kiểm lại `git rev-parse origin/main` = `MAIN_SHA`; `gh workflow run mcp-worker.yml --ref main -f production_sha=$MAIN_SHA -f confirm_production=true -f bootstrap_first_release=false -f rehearse_rollback=false`; chờ `production-release` xanh; ghi Release ID, Workflow build ID, Worker version ID.
7. **Kiểm MCP production**: `tqccl_get_entity` một mục `translation` → `profile.lookup.effectZhSource == {"kind":"translation"}`, `effect` khớp `zhEffects.text`; một mục `source` → `{"kind":"source"}`, không có `ref`; `tactic:lua-chay-ngun-ngut` → mã giữ.
8. **Mở đóng băng**.
9. **Docs** (commit cuối, sau khi mở đóng băng — ghi rõ SHA khớp "tại thời điểm phát hành"):
   - `docs/deployment.md`: mục Pages (deployment id, commit, run id, số test, kết quả ma trận HTTP với số rule thực) và mục MCP #2 (run id, commit, Release/Workflow build/Worker version ID, kiểm `effectZhSource`).
   - `docs/unified-lookup.md`: đầu vào `zhEffects` (3 kind, `viSha256`, `ref`/`note` riêng tư, host allowlist, chặn baseline), trường `lookup.effectZhSource`, `_redirects` sinh bởi route handles, phạm vi cờ (hồ sơ vi+zh, thẻ zh, bảng zh; meta zh bỏ hiệu ứng; roster chưa có cờ); sửa lệnh cũ `build_recommended_reference` ở `:94` nếu còn.
   - `docs/project-changelog.md`: một mục cho redirect + chữ Hán + cờ.
10. `ak plan` cập nhật trạng thái; dọn `~/w2/pipeline/lookup-output`, `.cache` nếu không cần.

## Todo
- [ ] Đóng băng `main` + blog
- [ ] Merge PR-B, ghi `MAIN_SHA`
- [ ] Deploy Pages, commit hash = `MAIN_SHA`
- [ ] Ma trận HTTP `fail=0`
- [ ] Trang mẫu: cờ, bảng zh, meta zh
- [ ] MCP #2 cùng SHA
- [ ] Kiểm `tqccl_get_entity`
- [ ] Mở đóng băng, docs

## Kiểm tra
- Ma trận HTTP `fail=0`.
- Commit hash Pages = `production_sha` MCP #2.
- `tqccl_get_entity` trả đúng `{kind}`, không `ref`.

## Rủi ro
- Token Cloudflare hết hạn → dừng hỏi.
- 301 bị trình duyệt cache lâu: lỗi đích phát hiện ở bước 4 vẫn còn ở client đã truy cập. Giảm thiểu bằng kiểm `wrangler pages dev` ở phase 02.
- `/tra-cuu/*` có `max-age=0, must-revalidate` nên không lo 404 cũ bị CDN giữ.
