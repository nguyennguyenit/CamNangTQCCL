# Bước 4 — Tích hợp và release readiness

Trạng thái: chưa triển khai. Phụ thuộc bước 1 + 2 + 3.
Context: [design](design.md), [MCP runbook](../../docs/mcp-research-server.md), [consumer handoff](../../docs/goclaw-mcp-skill-handoff.md).

## Files

Đọc lại trước cập nhật `docs/mcp-research-server.md`, `docs/goclaw-mcp-skill-handoff.md`, `README.md` và owner architecture/deployment docs. Chỉ ghi claims đã kiểm chứng; plan không là runtime authority.

## Thực hiện

1. Review public contracts bằng review skill hoặc reviewer được giao quyền: privacy, identity, error scrub, applicability và compatibility.
2. CLI/stdio/HTTP parity cả 7 tool P\*: success/error, pagination, stale cursor/binding/knowledge version và capability-unavailable trên v1/v2. `tools/list` không còn 8 tên cũ; input schema gốc không union, không `$ref`.
3. So website từng nhóm lookup và ba họ đội ở vi/zh; kiểm identity/slot/score/link. Kiểm toàn inventory và cross-reference để sample không che mất records.
4. Full checks trên Node đúng pin; release build từ exact clean source với evidence.
5. Docs mô tả tool delta, discovery refresh, fallback, rollback và consumer ownership; link schema owner thay vì copy schema.
6. Replay strict client với 7 tool mới (outputSchema validate cả nhánh lỗi). Không chạy song song release cũ; client chưa tương thích sau cutover thì rollback exact Worker version.
7. Nếu release được yêu cầu riêng, chạy exact-version smoke, edge control và rollback rehearsal theo runbook. Build local không chứng minh production.
8. Đo và cutover Dewee. Không deploy production cho tới khi code xong (user 2026-10-08); R0–R2 chạy trên MCP local:
   1. Chuẩn bị (user 2026-10-08: đo thẳng trên `tra`, không tạo agent thử): tạo server MCP stdio `tqccl-local`, cấp cho `tra`; tạm gỡ grant `tqccl` production của `tra` để agent không thấy hai bộ tool (server `tqccl` giữ nguyên). Command (đã chạy thử từ `/tmp`): `node --import <repo>/mcp-worker/node_modules/tsx/dist/esm/index.mjs <repo>/mcp-worker/src/stdio.ts` — dùng đường tuyệt đối cho tsx vì `--import tsx` không resolve được ngoài thư mục `mcp-worker`. Ghi mốc thời gian mỗi run để tách session đo khỏi hội thoại khác của `tra`.
   2. **R0**: `<repo>` = checkout `main` (code MCP như `9efe0dad9`, 8 tool cũ, dữ liệu hiện tại), reconnect `tqccl-local`, chạy [bộ hội thoại mẫu](evals/dewee-conversations.json).
   3. **R1**: `<repo>` = worktree branch `feat/mcp-skill-redesign` (đủ 7 tool, không tách Release 1/2 vì chỉ chạy local), reconnect, kiểm `tools/list` đúng 7 tên, chạy lại.
   4. **R2**: upload ba skill portable (`dewee skills upload <dir> --dry-run` rồi upload thật), cấp cho `tra`, kiểm hash khớp repo, chạy lại.
   5. Ship website trước, rồi deploy production một lần bằng workflow exact SHA; xem log Worker `mcp.tqccl.com` trước đó để tìm client khác Dewee; đổi service key cùng đợt; cấp lại grant `tqccl` cho `tra`, gỡ và xoá `tqccl-local`; reconnect server `tqccl` (tới khi [dewee#887](https://github.com/nextlevelbuilder/dewee/issues/887) được sửa); smoke vài case trên `tra`.
   6. Client ẩn báo lỗi sau deploy: rollback exact Worker version, rồi xử lý.
   Xem [Dewee runtime](reports/dewee-runtime-2026-10-07.md).

## Validation

Root: `npm run check`, `npm run test:node`, `npm run build`, `npm run test:dist`, `npm run verify`.

MCP: `npm run check`, `npm run test:worker`, `npm run test:stdio`, `npm run test:release`. Chạy narrow trước; không lặp full suite khi không có thay đổi/rủi ro mới. `check:repository` theo prerequisites hiện hành về assets, clean source và môi trường không có release credentials. Chọn E2E lookup/routes/season khi shared code thay đổi.

## Acceptance, rủi ro và rollback

- Source/data/workflow digests nhất quán; v3 deterministic và exact inventory.
- Không private data trong package/output/logs/docs. Consumer strict đã replay thật.
- Skills có behavioral evidence; thiếu gate thì ghi rõ, không gọi rollout hoàn tất.
- Capture/dedup/subject isolation/forget/promotion CAS/rollback có evidence; không ship private learning store vào Assets.
- Mỗi process có command/PID/port/worktree và được dừng khi xong; không đổi port để né stale owner.
- Thêm output field vẫn có thể phá strict client: refresh discovery trước promotion.
- Rollback exact Worker version phục hồi code+data; consumer bỏ binding/cursor cũ và refresh version. Skill rollback riêng, không revert WIP người khác.

## Câu hỏi chưa giải quyết

Endpoint đã probe liveness/auth rejection; authenticated readiness, consumer versions và rollout authorization cần xác định khi release. Host feedback đầu tiên, retention và promotion allowlist cần chốt trước bật learning.

Consumer mục tiêu là Dewee. Xem [đề xuất auth và các probe isolation](dewee-access-design.md) và [source scan đã pin](reports/dewee-source-scan.md). Source gốc có credential/pool riêng user, OAuth resolve theo tenant/server; chưa chứng minh binary local tương ứng. Nếu chọn per-user access, cần triển khai registry/quyền/quota phía MCP và kiểm chứng credential routing, partial-default inheritance, OAuth conflict, rotate/cache và channel identity phía Dewee trước rollout; bearer current/next hiện tại chỉ phục vụ rotation.

## Bổ sung mùa mặc định

Smoke policy rollover/rollback, pinned account, stale policy và scenario chưa có ruleset; release policy cùng game snapshot. Xem [season design](season-resolution-design.md).
