# Phase D1: Worker nhận locale `ja` và fixture eval ảnh client Nhật

Ngày 2026-11-17. Branch `feat/ja-locale-d1-worker` (từ `feat/ja-locale`).

## Kết quả

- `worker/test` 196 test xanh, `npm run typecheck` xanh.
- `tests-js/worker-locales-parity.test.mjs` hiện **đỏ có chủ đích**: Worker khai `["vi","zh","ja"]`, còn `js/i18n.js` trên nền hiện tại mới có `vi`/`zh`. Test xanh khi phase C đưa `ja` vào danh sách locale của site (đúng thứ tự ghép C trước D). Test nhận cả hai tên export `SITE_LOCALES` và `LOCALES`.
- Chưa chạy eval AI thật (không có khóa), chưa deploy.

## Thay đổi

- `worker/src/locales.ts` (mới): `WORKER_LOCALES`, kiểu `WorkerLocale`, `isWorkerLocale`. Thêm ngôn ngữ chỉ sửa ở đây và hai bảng `satisfies Record<WorkerLocale, string>` trong `model.ts` (TypeScript báo lỗi nếu thiếu câu).
- `schema.ts`: `ExplainContext.locale: WorkerLocale`; validator dùng `isWorkerLocale` (từ chối `ko`, rỗng, sai kiểu).
- `model.ts`: `promptByMode(mode, locale?)`, `buildRequestBody`/`callModel` nhận `locale`. Với `ja`: thay câu ép giản thể bằng câu chép nguyên tự dạng Nhật (kana giữ nguyên), nối đoạn mô tả client 三國志 真戦 (戦報, 味方/敵, 主将/副将, 通常攻撃 không phải chiến pháp), ba prompt quét kho đổi cụm "chữ Hán giản thể" tương ứng. Quy tắc chỉ chép chữ in, không đoán qua chân dung, thứ tự phe giữ nguyên. `explainPrompt` có bảng câu ngôn ngữ cho vi/zh/ja (ja trả lời 日本語).
- `index.ts`: `resolveImageLocale` đọc `payload.locale` ngay sau `resolveAnalyzeMode`, trước KV/Turnstile; sai -> 400 `Locale không hợp lệ` kèm CORS; chỉ áp cho bốn mode ảnh. `explainSubstitute` không đọc locale cấp ngoài.
- `worker/README.md`: trường `locale`, chính sách prompt ja, mã lỗi.
- Test: schema (ja nhận, ko/rỗng/sai kiểu bị từ chối), model (băm SHA-256 cố định cho prompt vi/zh của cả bốn mode và explain, chụp từ code trước khi sửa: vắng locale, vi, zh ra đúng từng byte; ja có đoạn tự dạng Nhật và không còn câu ép giản thể), index/scan-modes (locale sai -> 400 trước mọi lời gọi ngoài, bốn mode đều nhận ja).

## Fixture eval

`worker/eval/fixtures/battle-ja-1.json`, `battle-ja-2.json`, đúng định dạng cũ (2 chiến pháp đã học mỗi tướng, bỏ dòng tự mang và 通常攻撃; `book: null`). Đã mở ảnh kiểm vị trí; phe phải đọc phải sang trái để 主将 đứng đầu.

Điểm cần chủ repo biết:

1. Bảng `ja-names-observed` ánh xạ 荀彧/貂蝉/盧植/曹操/郭嘉… sang tướng thường, nhưng ảnh có nhãn SP và dòng chiến pháp tự mang (機転先決, 舞癒, 国の柱石, 承天靖世, 経天緯地, 江天長焔, 遡江揺櫓) đúng là chiến pháp tự mang của biến thể SP trong `data/heroes-dict.json`. Fixture dùng ID SP: `sp-tuan-uc`, `sp-quach-gia`, `sp-dieu-thuyen`, `sp-lo-thuc`, `sp-tao-thao`, `sp-chu-du`, `sp-lu-mong`. Riêng 荀攸 (`hero:tuan-du`) và 陸遜 (`hero:luc-ton`) từ điển chưa có biến thể SP nên dùng bản thường. Trường `source` ghi rõ lý do.
2. `転・獅子奮迅` (ảnh 1, 荀攸) để `null`: bảng tên chỉ có `baseId: tactic:su-tu-phan-tan` kèm ghi chú repo chưa có ID riêng cho bản chuyển thuộc tính.
3. Ảnh 1 đã che tên người chơi (theo đề bài). Ảnh 2 chỉ có tên server/liên minh công khai (江淮, 西涼), không có tên người chơi. Nguồn hai ảnh ghi "chờ chủ repo xác nhận" (câu hỏi Q6 của plan).
4. Kiểm tĩnh: mọi ID trong fixture có trong từ điển; chấm thử bằng `scoreFixture` với output giả đúng đáp án (tên Hán canonical) cho 100% heroes/tactics/screen/sides ở cả hai fixture. Chưa chấm bằng tên Nhật vì đó là việc phase D2 (alias).

## Không làm

- Không sửa `score.ts`, `run-eval.ts`, `eval-score.test.ts` (phase D2).
- Chưa ghim lại localization cho `worker/src/schema.ts` (có trong `policy.sourceFiles`): chuỗi ghim sinh nhiều file generation, plan giao H làm lại sau khi ghép. Cần ghim trên branch này nếu muốn chạy `npm run build` cục bộ.
- Build/verify cấp site không chạy.

## Câu hỏi chưa giải

- Chủ repo xác nhận nguồn hai ảnh (Q6) để điền `source`.
- Chấp nhận dùng ID SP cho fixture thay vì ID tướng thường trong bảng quan sát? Nếu D2 alias chỉ ánh xạ tên Nhật sang tướng thường, bộ chấm sẽ cần chọn biến thể SP khi tên in trùng (liên quan thiết kế D2).

Status: DONE_WITH_CONCERNS
