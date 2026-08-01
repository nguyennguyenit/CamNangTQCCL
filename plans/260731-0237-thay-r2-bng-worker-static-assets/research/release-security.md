# Nghiên cứu release và bảo mật sau R2

Ngày: 2026-07-31

> Quyết định sau red-team: thay preview-primary bằng serialized `0% + Version Override` gate để dùng production edge controls và tránh preview hostname tồn tại lâu.

## Release unit

Một Worker Version là đơn vị release duy nhất gồm code + static assets. Mỗi lần cập nhật mùa tạo một version mới; không thêm `seasonId` vào public schema. Git commit SHA, Worker version ID, `releaseId` và `workflowBuildId` là evidence bắt buộc.

## Giữ

- Clean-source build và canonical manifest/SHA-256.
- Credential-free repository gate, coverage, typecheck, workerd, Wrangler dry-run.
- Authenticated live verifier và managed bearer rotation.
- Edge rate-limit monitor; isolate-local limiter chỉ là defense-in-depth.
- `/healthz` public liveness và `/mcp` authenticated readiness.

## Bỏ

- Hai-bucket lock/events, pointer CAS, activation lock, promotion receipt.
- R2 stage/activate credentials và AWS S3 client.
- Force-refresh header: assets bất biến trong cùng Worker version.
- Npm distribution: package tiếp tục `private`, GoClaw dùng remote MCP URL.

## Quy trình quý

1. Curate dữ liệu trên branch/worktree và review evidence/diff.
2. CI build đúng bảy file: `manifest.json` + sáu JSON.
3. Merge exact commit; protected environment duyệt production.
4. Upload version, add candidate ở `0%`, verify bằng Version Override + bearer + expected identities.
5. Promote duy nhất version đó lên `100%`, rồi verify production.
6. Nếu fail sau promote, rollback known-good Worker version; không rollback bearer.

R2 resources hiện có, nếu đã được tạo trước cutover, chỉ retire sau khi rehearsal rollback version cũ hoàn tất. Việc retire external resource không thuộc implementation tự động của kế hoạch này.
