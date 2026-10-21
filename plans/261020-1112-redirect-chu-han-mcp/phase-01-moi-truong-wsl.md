---
phase: 1
title: "Môi trường WSL và baseline"
status: pending
priority: P1
effort: "2h"
dependencies: []
---

# Phase 1 — Môi trường WSL và baseline

<!-- Updated: Red Team 2026-10-20 - một chiều sinh đầu ra (chỉ ~/w2), ngừng commit từ Windows khi phase 06 bắt đầu -->

## Mục tiêu
Có một bản sao Linux thật của `main` trong WSL để chạy pipeline Python (`fcntl`, `O_NOFOLLOW`), Node 24 và Playwright, với gate xanh trên `main` trước khi sửa gì.

## Bằng chứng
- `pipeline/build_unified_lookup.py:6`, `pipeline/promote_unified_lookup.py:6` import `fcntl`; Python không có trên PATH Windows.
- WSL `Ubuntu`: `~/w` là git checkout nhánh cũ `feat/global-client-lookup`, có sửa dở `community-worker/src/app.ts`; `~/node/bin` (Node 24.14.1), `~/pwlibs`, `/usr/bin/python3`. Script `setup-w.sh`/`sync-w.sh`/`publish-w.sh`/`repin.py`/`back-w.sh` đã mất.

## File
- Không sửa file trong repo.
- Tạo trong WSL: `~/w2` (clone mới). Không đụng `~/w`.

## Các bước
1. Clone sạch, không dùng `~/w` (có thay đổi cục bộ của người dùng):
   ```bash
   wsl.exe -d Ubuntu -- bash -lc 'git clone "$(wslpath "C:/Users/PC/Desktop/Projects/CamNangTQCCL")" ~/w2 && cd ~/w2 && git remote set-url origin "$(cd "$(wslpath "C:/Users/PC/Desktop/Projects/CamNangTQCCL")" && git remote get-url origin)" && git fetch origin && git checkout -B main origin/main'
   ```
2. Toolchain: `export PATH=~/node/bin:$PATH`; `npm ci` ở gốc và `mcp-worker/`; `python3 --version` (≥3.12 theo `pages-deploy.yml`).
3. Quy ước đồng bộ, dùng suốt plan:
   - Sửa code trên Windows; đẩy sang WSL bằng commit lên nhánh làm việc rồi `git -C ~/w2 pull` (nhánh: `feat/redirect-301` cho PR-A, `feat/chu-han-nguon` cho PR-B).
   - Đầu ra pipeline chỉ sinh trong `~/w2`, commit từ `~/w2` rồi `git pull` về Windows. Không copy file tay qua `/mnt/c`.
   - Từ khi phase 06 bắt đầu tới khi PR-B merge: không commit từ phía Windows lên nhánh PR-B (tránh commit chen sau đầu ra sinh).
4. Baseline gate trên `main` trong `~/w2` (ghi kết quả vào phần Bằng chứng chạy):
   ```bash
   python3 -m unittest discover -s tests
   node --experimental-strip-types --test tests-js/*.test.mjs
   npm run build && npm run verify && npm run test:dist
   (cd mcp-worker && npm run check)
   python3 -m pipeline.lookup_route_handles --check
   python3 -m pipeline.team_route_handles --check
   LD_LIBRARY_PATH=~/pwlibs/root/usr/lib/x86_64-linux-gnu npx playwright test
   ```
5. Test nào đỏ trên `main` thì ghi lại là lỗi có sẵn (không sửa trong plan này trừ khi chặn).

## Todo
- [ ] Clone `~/w2` từ `origin/main`
- [ ] `npm ci` gốc + `mcp-worker`
- [ ] Baseline gate, ghi số liệu

## Kiểm tra
- `git -C ~/w2 rev-parse HEAD` = `git rev-parse origin/main` trên Windows.
- Baseline: số test pass/fail của từng lệnh được ghi lại; `lookup_route_handles --check` pass.

## Rủi ro
- `domain-budget` perf test trong `mcp-worker` có tiền sử flaky: chạy lại một lần trước khi coi là lỗi.
