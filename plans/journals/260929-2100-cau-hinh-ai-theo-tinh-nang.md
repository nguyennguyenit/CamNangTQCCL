# Cấu hình AI theo tính năng (model, effort, timeout riêng; nhà cung cấp dùng chung)

## Việc đã làm
- `ai:providers` (danh sách provider có `modelId`) thay bằng bản ghi `ai:config` `{providers, groups}`. Provider chỉ còn endpoint + key + `extraModels`; catalog model tĩnh ở `shared/ai-models.ts`. Bốn nhóm (`teamScan`, `rosterRecommend`, `explainSubstitute`, `battleReport`) có chuỗi `(provider, model, effort)` riêng, timeout mỗi lượt và trần tổng.
- `callWithFailover` nhận `AiRoute` và tự thêm trường suy luận theo `effortStyle`; bỏ `thinking: disabled` cứng ở hai Worker.
- Tab AI `/quan-tri/` có hai phần Nhà cung cấp / Tính năng.

## Quyết định
- Dùng khoá KV mới thay vì ghi schema mới vào `ai:providers`: `toProvider` cũ bỏ mục thiếu `modelId`, nên `worker/` bản cũ sẽ trả 503 nếu hai Worker lệch phiên bản.
- Migration v1 → v2 chỉ trong bộ nhớ, trần tổng không giới hạn (45 s × số mục bật) để giữ đúng vòng failover cũ.
- Sau review: key để trống chỉ được giữ khi cùng id **và** cùng endpoint; khung sửa nhà cung cấp lưu theo id (trước đây theo index, có thể ghi đè nhầm mục và mất key).

## Còn lại
- Deploy hai Worker → Pages → admin bấm Lưu → gỡ `LEGACY_PROVIDERS_KEY`/`migrateLegacy` + xoá khoá `ai:providers` (docs/community-worker.md).
- Chưa kiểm chứng: Zen có chuyển `thinking`/`reasoning_effort` cho model DeepSeek; cờ `vision` của `deepseek-v4-pro`.
