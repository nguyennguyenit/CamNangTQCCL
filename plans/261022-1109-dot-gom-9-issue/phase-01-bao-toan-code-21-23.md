---
phase: 1
title: "Bảo toàn code #21/#23"
status: done
priority: P1
effort: "0.25d"
dependencies: []
---

# Phase 1: Bảo toàn code #21/#23

## Goal

Toàn bộ thay đổi chưa commit của #21/#23 trong worktree được commit lên nhánh `feat/dong-bo-kho-va-doi-cua-toi` và đẩy lên remote, không lẫn secret, để không mất khi worktree hỏng hoặc bị dọn.

<!-- Updated: Red Team 2026-10-22 - đếm đúng số path; quét secret cả file untracked bằng scanner của repo -->

## Bối cảnh

- Worktree: `/Users/plateau/Project/worktrees/CamNangTQCCL-dong-bo-kho-va-doi-cua-toi`, nhánh `feat/dong-bo-kho-va-doi-cua-toi`, tip `1fa81ab` (bằng merge-base với `main`). Nhánh chưa có trên remote. Repo private.
- `git status --short` gộp thư mục untracked thành một dòng (171 dòng). Số path thật sẽ commit: khoảng 272 (37 sửa, 93 xóa, 142 untracked, gồm generation `7949…` mới). Danh sách: [reports/scout-21-23-plan-release.md](./reports/scout-21-23-plan-release.md) mục 1 và phase 10 mục "Cách chuyển từng file".
- Generation bản dịch trong snapshot là của base cũ. Phase 4 và 10 lấy code từ snapshot theo từng file; không merge nguyên snapshot vào `main`.
- Root `.gitignore` và `mcp-worker/` không có quy tắc cho `.dev.vars`/`.env`; chỉ `worker/.gitignore:2` và `community-worker/.gitignore:1` có.

## Files to Create / Modify

- Không sửa nội dung file code. Chỉ commit và push trong worktree.
- Plan cũ `plans/261021-0632-dong-bo-kho-va-doi-cua-toi/` và journal trong worktree commit cùng snapshot (bản trong worktree là bản đúng, có `status: done` và phase 07 đã sửa cho đợt này).

## Tasks & Steps

1. Liệt kê path sẽ commit: `git -C <worktree> add -A -n > /tmp/snapshot-paths.txt; wc -l < /tmp/snapshot-paths.txt`.
2. Chặn secret:
   - Không path nào khớp `(^|/)\.(dev\.vars|env)(\..*)?$` trong `/tmp/snapshot-paths.txt`; có thì dừng.
   - Trong worktree: `cd mcp-worker && npm ci && npm run --silent check:local-secrets` (scanner của repo, quét cả file untracked không bị ignore).
   - Grep bổ sung các loại khóa repo dùng mà scanner chưa bắt: `git -C <worktree> grep --untracked -nE 'GOCSPX-|BETTER_AUTH_SECRET=\S|CLOUDFLARE_API_TOKEN=\S|AI_CONFIG_SECRET=\S'` không ra kết quả.
3. Commit snapshot: `git -C <worktree> add -A && git -C <worktree> commit -m "wip(roster): snapshot #21/#23 implementation before batch landing"`.
4. Đẩy nhánh: `git -C <worktree> push -u origin feat/dong-bo-kho-va-doi-cua-toi`. Không mở PR cho nhánh này.

## Verification

- `git -C <worktree> status --short` rỗng.
- `git -C <worktree> show --stat --format= HEAD | tail -1` báo số file bằng số dòng ở bước 1.
- `git ls-remote origin feat/dong-bo-kho-va-doi-cua-toi` trả SHA của commit snapshot.

## Kết quả (2026-10-22)

- `git add -A -n`: 272 path; không path `.dev.vars`/`.env`; `check:local-secrets` sạch; grep khóa bổ sung không ra kết quả.
- Commit `a4cf6c152c0df2fc4ec293b643d2359373007900` "wip(roster): snapshot #21/#23 implementation before batch landing": `git show --stat --no-renames` = 272 file (179 khi gộp rename của generation).
- `git ls-remote origin feat/dong-bo-kho-va-doi-cua-toi` = `a4cf6c1…`; worktree `status --short` rỗng.

## Risks

- Commit lẫn file bí mật: bước 2 chặn.
- Snapshot chứa generation bản dịch cũ: chấp nhận; không merge snapshot vào `main`.
