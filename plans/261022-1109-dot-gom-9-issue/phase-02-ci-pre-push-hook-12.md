---
phase: 2
title: "CI và pre-push hook (#12)"
status: done
priority: P2
effort: "0.5d"
dependencies: []
---

# Phase 2: CI và pre-push hook (#12)

## Goal

Push thẳng `main` không chờ CI 25 phút; PR vẫn chạy đủ `check:repository`; `main` được kiểm đầy đủ hằng tuần; máy local chặn push khi các kiểm nhanh fail.

## Hiện trạng (bằng chứng: [reports/scout-15-16-12.md](./reports/scout-15-16-12.md) mục #12)

- `.github/workflows/mcp-worker.yml:3-24` `workflow_dispatch`, `:25-46` `pull_request`, `:47-70` `push: branches:[main]`; hai danh sách `paths` giống nhau, thiếu `agent-knowledge/**` (đọc ở `mcp-worker/scripts/generate-knowledge-bundle.ts:22`).
- Job `credential-free-release-gate` (`:75-118`) không dùng `secrets.*` hay `vars.*`. Job `production-release` (`:120+`) chỉ chạy khi `workflow_dispatch` + `refs/heads/main` + `confirm_production == true` (`:121`).
- `mcp-worker/test/release/workflow-release-contract.test.ts` đọc file workflow nhưng không kiểm trigger.
- Chưa có `.githooks/`, `core.hooksPath` chưa đặt. README "Chạy local"/"Kiểm thử" ở `README.md:39-77`.
- Thời gian đo: `check:workflow-build` 0.8s, `check:knowledge-bundle` 0.4s, mcp-worker `typecheck` 2.5s, `python3 -m unittest discover -s tests` 80s, `community-worker npm test` 5s. `npm run test:node` phụ thuộc `dist/` đã build: chạy trên `dist/` cũ cho 3 lỗi giả.

## Files to Create / Modify

- Modify: `.github/workflows/mcp-worker.yml` — xóa khối `push`; thêm `schedule: - cron: "23 3 * * 1"` (thứ Hai 03:23 UTC); thêm `agent-knowledge/**` vào `pull_request.paths`.
- Create: `.githooks/pre-push` (mode 100755).
- Create: `tests-js/ci-workflow-contract.test.mjs`, `tests-js/pre-push-hook.test.mjs`.
- Modify: `README.md` — mục "Pre-push hook" sau "Kiểm thử".
- Modify: `docs/deployment-guide.md` và `docs/mcp-research-server.md:68` nếu mô tả CI chạy trên mọi push.

## Nội dung hook

<!-- Updated: Red Team 2026-10-22 - hook quét secret, chạy build+verify khi push main, từ chối working tree bẩn -->

`.githooks/pre-push`, `#!/usr/bin/env bash`, `set -euo pipefail`:

1. Đọc stdin của git (`<local ref> <local sha> <remote ref> <remote sha>`). Nếu mọi dòng có local sha toàn số 0 (xóa nhánh) hoặc ref là tag: thoát 0.
2. Từ chối khi working tree bẩn (`git diff --quiet HEAD` và không có file untracked không bị ignore), vì các kiểm đọc file trên đĩa chứ không đọc commit được push. In hướng dẫn `git stash -u` và thoát 1.
3. Luôn chạy, dừng ở lỗi đầu tiên:
   - `(cd mcp-worker && npm run --silent check:local-secrets && npm run --silent check:workflow-build && npm run --silent check:knowledge-bundle && npm run --silent typecheck)`
   - `(cd community-worker && npm test --silent && npm run --silent typecheck)` — lấp chỗ CI không chạy community-worker.
   - `python3 -m unittest discover -s tests`
4. Nếu có dòng nào có remote ref `refs/heads/main`: chạy thêm `npm run build && npm run verify` (đúng cổng mà `pages-deploy.yml:49-50` chạy khi blog deploy). Đây là chốt chặn cho push thẳng `main` khi không còn CI trên `push`.
5. Không chạy `npm run test:node` và e2e: cần `dist/` mới và lâu; PR CI đã chạy đủ. Ghi rõ trong README.

Thiếu `node_modules` trong `mcp-worker/` hoặc `community-worker/`: in hướng dẫn `npm ci` và thoát 1.

## Quy tắc merge PR (áp dụng cho mọi phase của đợt)

Không có branch protection, nên CI xanh trên base cũ không bảo đảm `main` xanh sau merge. Trước khi merge mỗi PR: `gh pr update-branch <số PR>` (hoặc rebase), chờ CI chạy lại xanh trên head mới, rồi mới merge. Sau khi merge: checkout sạch đúng SHA đã merge, `npm ci && npm run build && npm run verify`, ghi kết quả vào PR. Đỏ thì sửa tiến hoặc revert ngay, không để qua lần đăng blog kế tiếp.

## TDD (viết test trước, phải đỏ trước khi sửa)

`tests-js/ci-workflow-contract.test.mjs` (đọc YAML bằng parser đã có trong repo, hoặc so khớp text nếu không có parser):

1. `on` không có `push`.
2. `on.pull_request.paths` có `agent-knowledge/**` và mọi đường dẫn cũ.
3. `on.schedule[0].cron` có 5 trường, trường thứ 5 (ngày trong tuần) không phải `*`.
4. `on.workflow_dispatch.inputs` giữ đủ `production_sha`, `confirm_production`, `bootstrap_first_release`, `rehearse_rollback`.
5. Job `credential-free-release-gate` không chứa `secrets.`, `vars.`, `environment:`.
6. Job `production-release` vẫn có điều kiện `github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.confirm_production == true`.

`tests-js/pre-push-hook.test.mjs` (chạy hook với `PATH` chứa lệnh giả `npm`/`python3` ghi log và trả mã thoát cấu hình được):

7. `git ls-files -s .githooks/pre-push` cho mode `100755`; dòng đầu là shebang.
8. Lệnh giả đầu tiên trả 1 → hook trả khác 0 và không chạy lệnh sau.
9. Mọi lệnh giả trả 0 → hook trả 0, log có đủ các bước theo thứ tự.
10. Stdin là xóa nhánh (`(delete) 0000… refs/heads/x <sha>`) → hook trả 0, không chạy lệnh nào.
11. Working tree bẩn → hook trả 1 trước khi chạy lệnh nào.
12. Remote ref `refs/heads/main` → log có `build` và `verify` sau các bước luôn chạy; remote ref nhánh khác → không có.
13. `check:local-secrets` là bước đầu tiên được chạy.

## Verification

- `node --test tests-js/ci-workflow-contract.test.mjs tests-js/pre-push-hook.test.mjs` xanh.
- `git config core.hooksPath .githooks && git push --dry-run` trong checkout chính và trong một worktree: hook chạy, in từng bước.
- Mở PR cho phase này: workflow chạy trên `pull_request`.

## Risks

- `--no-verify` bỏ qua hook; chấp nhận theo quyết định A'.
- `core.hooksPath` dùng chung cho mọi worktree; worktree đang ở nhánh cũ chưa có `.githooks/` thì hook không chạy cho tới khi nhánh đó rebase.
- `schedule` chỉ chạy từ file workflow trên nhánh mặc định, sau khi PR này merge.
