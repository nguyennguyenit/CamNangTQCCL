# Bản đồ tác động R2 → Worker Static Assets

Ngày: 2026-07-31

## Giữ

- `DataSource`, `FilesystemDataSource`, canonical manifest, snapshot validator.
- Full `releaseId`, `dataVersion`, `workflowBuildId`, `workflowVersion`.
- Tám `tqccl_*` tools và parity CLI/stdio/HTTP.
- Bearer, origin/body/result/in-flight guards, edge rate rule, live verifier.
- `build-data-release.ts` làm nền cho asset builder, nhưng đổi output contract.

## Thay

- `R2DataSource` bằng capability hẹp đọc `ASSETS.fetch()`.
- Hai R2 bindings bằng `assets.directory`, `binding: "ASSETS"`, `run_worker_first: true`.
- Workerd fixture và performance fixture sang production-shaped static assets.
- R2 stage/activate/pointer release thành Worker version upload/0%-override/promote/rollback.
- Control-plane verifier chỉ còn edge rate control.

## Xóa sau khi Static Assets gate xanh

- `src/data/r2-data-source.ts`
- `scripts/r2-release-store.ts`
- `scripts/stage-data-release.ts`
- `scripts/activate-data-release.ts`
- `scripts/publish-data-release.ts`
- `src/release/promotion-receipt.ts`
- Các test/fixture R2 tương ứng.
- `@aws-sdk/client-s3`, R2 credentials, bucket bindings và R2 monitor.

`cloudflare-deployment-client.ts` được giữ và thu gọn thành expected-current promote/rollback controller; không giữ logic R2.

## Hợp đồng bất biến

- Đúng tám tool names và schema hiện hành.
- `releaseId` vẫn là full digest của canonical manifest.
- `workflowVersion`, cursor và confirmation binding vẫn dùng full `releaseId`.
- Lỗi asset nội bộ map thành public `DATA_UNAVAILABLE` an toàn, không lộ path/URL/value.
- Không raw image/base64/path, mutation API, GoClaw implementation hay npm publishing.
