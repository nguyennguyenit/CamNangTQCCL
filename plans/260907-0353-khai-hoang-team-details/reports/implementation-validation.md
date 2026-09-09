# Xác minh triển khai — Khai hoang team details

Ngày: 2026-09-09. Không có commit, deploy hay pipeline rebuild.

## Phạm vi và đối chiếu

- 11 card Yaojing đã được map vào 11 `teams[].guide` trong 17 đội khai hoang; ledger: [image-transcription-ledger.md](./image-transcription-ledger.md).
- Guide thuộc bộ ba tướng, không nằm ở variant. Có sáu nhóm: tổng quan, điểm, yêu cầu đỏ, thủ đất/cảnh báo, tách đội và chuyển hình.
- Build 7/9 tách khỏi guide: image 7 chỉ xác minh sau cấp 20; image 9 giữ SP Chu Tuấn → Gia Cát Khác theo hai giai đoạn.
- UI chính không hiện mùa/khu vực/nguồn; metadata nội bộ và link nguồn Chạm Sứ không đổi.

## RED → GREEN

Hai lỗi assertion trong lúc viết test (strict locator nhiều card và giả định sai một stage badge) là lỗi test authoring, không được tính là RED hành vi sản phẩm.

RED có ý nghĩa: payload route với parent `guide: { ratings: {}, defenders: {}, transitions: [] }` trước khi thêm guard vẫn tạo `.kh-guide` chỉ có note phạm vi; payload có `variant.guide` cũng không được phép làm fallback. Regression `empty parent guides and variant-only guides do not create a roster guide` khóa cả hai biên; GREEN khi 12 E2E Khai hoang pass. Các regression khác giữ state guide qua variant, current-only wording, ordered city 7 → city 8 → 48h, 320px, keyboard và stage data 7/9.

## Gates

Runtime shell mặc định là Node `v24.14.0`, ngoài engines. Dùng runtime tạm thời `node@22.12.0` qua `npx --yes -p node@22.12.0 -c ...`; không cài global và không thay `package.json`.

| Lệnh | Kết quả |
| --- | --- |
| `node --version` (Node runner) | `v22.12.0` |
| version gate `major===22 && minor>=12` | pass |
| `npm run check` | pass, 0 diagnostics |
| `npm run test:node` | pass, 143 tests |
| `npm run test:e2e` | pass, 26 tests |
| `npm run test:e2e -- --project=astro tests-e2e/khaihoang-options.spec.mjs` | pass, 12 tests |
| `npm run test:dist` | pass, 9 tests |
| `npm run verify` | pass, 36 dist files / 33 raw assets |
| `git diff --check` | pass |

Lần E2E Node 22 đầu tiên dừng khi port 4174 vừa còn listener sau harness teardown. `lsof` ngay sau đó không có listener; rerun tuần tự pass. Không có process nào bị kill.

## Responsive và public route

- Browser test chạy trên route `/#khaihoang` với JSON runtime, không chỉ fixture.
- 375px: keyboard native select và guide được kiểm, không overflow.
- 320px: card guide dài mở được, `scrollWidth <= innerWidth`.
- 1280px/375px: Chạm Sứ độc lập vẫn giữ thứ tự và source link.

## Giới hạn còn lại

Nguồn Yaojing là phương án research theo nguồn, không xác nhận tier Global hay tỷ lệ thắng. Image 7 trước cấp 20 vẫn không đủ evidence để điền commander/unit/tactics; UI nêu đúng omission. Dữ liệu runtime curated nên không chạy `python -m pipeline.build_json`.

## Review công khai

Review độc lập không có finding Critical. Hai finding Medium đã được xử lý trước gate cuối: variant dùng `displayLabel` trung tính dựa trên chiến pháp/giai đoạn thực tế; tách đội giữ prose nguồn có kiểm tra `target` và `note` khi không có cấu trúc hero/tactic, thay vì suy diễn holder từ phương án thay thế.
