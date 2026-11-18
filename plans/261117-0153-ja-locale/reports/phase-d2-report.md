# Phase D2: Bộ chấm eval Soi đội dùng alias tên Nhật

Ngày 2026-11-18. Branch `feat/ja-locale-d2-eval` (từ `feat/ja-locale`).

## Kết quả

- `(cd worker && npm test)`: 9 file, 202 test xanh. `npm run typecheck` xanh.
- Chưa chạy eval AI thật (không có khóa), chưa deploy.

## Thay đổi

- `worker/eval/score.ts`: `buildIndexes(dicts, jaEntries?)` cho từng từ điển đi qua `withLocaleAliases` khi có `jaEntries` (không có thì hành vi cũ). Thêm `isJaFixture(fixture, name)`: trường `locale: "ja"` hoặc tên/ảnh dạng `*-ja-*`; `Fixture.locale?` tuỳ chọn. Fixture ja của D1 không có trường `locale` (không thuộc sở hữu D2) nên nhận diện bằng tên.
- `worker/eval/run-eval.ts`: fixture Nhật dùng chỉ mục có alias (nạp lười `data/lookup-ja.json`), fixture vi/zh dùng chỉ mục cũ. Khi gọi AI thật, fixture Nhật truyền `locale: "ja"` cho `callModel`, nếu không prompt vẫn ép giản thể và đo sai điều cần đo.
- `worker/README.md`: một đoạn về fixture Nhật và lệnh `--only battle-ja-1`.
- `worker/test/eval-score.test.ts`: dùng từ điển thật và `lookup-ja.json`.
  - Output giả chép đúng tên Nhật theo ID đáp án (gồm SP荀彧, 機転先決, 経天緯地...) chấm 100% tướng và chiến pháp ở cả `battle-ja-1` và `battle-ja-2`.
  - Cùng output chấm bằng chỉ mục không alias thì chiến pháp thấp hơn, chứng tỏ alias tạo ra điểm.
  - Output chép chữ Hán canonical vẫn 100% và bằng đúng điểm của chỉ mục không alias.
  - Năm fixture vi/zh (`battle-vi-1`, `battle-simplified-1`, `battle-trad-1`, `battle-trad-2`, `team-detail-1`): điểm giữa hai chỉ mục bằng nhau, và không bị nhận là fixture Nhật.

## Quan sát

Tên tướng SP trong ảnh Nhật ("SP荀彧") đã khớp được với từ điển hiện tại (bộ khớp bỏ khoảng trắng, từ điển có "SP 荀彧"), nên phần alias chủ yếu cứu chiến pháp tên Nhật khác chữ giản thể. Câu hỏi tồn đọng của D1 về biến thể SP không phát sinh: ID SP đáp án khớp trực tiếp qua tên in có tiền tố SP.

## Lệnh chạy khi có khóa

```bash
cd worker
EVAL_ENDPOINT=… EVAL_API_KEY=… EVAL_MODEL=… npm run eval:vision -- --only battle-ja-1
```

## Câu hỏi chưa giải

- Nên thêm `"locale": "ja"` vào hai fixture ja (file D1) cho tường minh? Hiện nhận diện bằng tên file.
