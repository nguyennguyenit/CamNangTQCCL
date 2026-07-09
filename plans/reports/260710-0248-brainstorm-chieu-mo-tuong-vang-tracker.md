---
type: brainstorm-report
date: 2026-07-10
topic: chieu-mo-tuong-vang-tracker
status: agreed
flags: local-first, no-ocr-phase-1, no-cloud-sync-phase-1
---

# Brainstorm: Theo dõi chiêu mộ tướng vàng

## Summary

Chốt phase đầu: thêm tab `Theo dõi chiêu mộ` trong website static hiện tại để user theo dõi lịch sử ra tướng 5 sao và pity 30. App local-first bằng `localStorage`, hỗ trợ nhiều account, xuất/nhập JSON. Chỉ theo dõi banner có 5 sao: `Danh tướng PK` hằng ngày và các banner/gói hạn giờ nhập thủ công. Bỏ `Tướng tài PK`.

Không làm OCR, upload ảnh, cloud sync, counter “chiêu mộ tiếp 2 lần”, hoặc community rule “5+1 core pity” trong phase đầu.

## Codebase Context

| Mục | Phát hiện |
|---|---|
| Project type | Static website, vanilla HTML/CSS/JS, không bundler |
| Storage pattern | `js/app.js` đã dùng `localStorage` cho theme |
| Tab/navigation | `index.html` + `js/app.js` quản lý section |
| Data tướng | `data/heroes-dict.json` có 112 tướng, nhưng thiếu tướng mới như `SP Mã Siêu`, `SP Quan Vũ` |
| Team data | `data/teams.json` có thể dùng làm tín hiệu phụ cho độ phổ biến tướng |
| Constraint | Không backend/auth trong phase đầu |

## Problem Statement

Người chơi TQCCL quay tiết kiệm miễn phí/nửa giá mỗi ngày, có thể chơi nhiều account. Vấn đề chính không phải “ghi mọi lần quay” mà là:

- Nhớ mỗi account/banner đang ở pity bao nhiêu.
- Biết lần nào đã ra 5 sao, tướng gì, ở banner nào.
- Không nhầm giữa roll hằng ngày và roll đột xuất/gói hạn giờ.
- Backup/restore được giữa thiết bị bằng JSON.

Success: mở tab là thấy account hiện tại, pity `Danh tướng PK`, trạng thái 4 slot quay hằng ngày, banner hạn giờ đang theo dõi, và lịch sử 5 sao mới nhất.

## Agreed Scope

| Decision | Chốt |
|---|---|
| Tab | 1 tab mới: `Theo dõi chiêu mộ` |
| Storage | `localStorage` + `Xuất JSON` / `Nhập JSON` |
| Account | Nhiều account, active account phải rõ |
| Banner theo dõi | `Danh tướng PK` + banner/gói hạn giờ nhập thủ công |
| Bỏ | `Tướng tài PK`, vì không cần theo dõi 5 sao |
| Pity | Tính mốc 30 theo `account + banner` |
| Daily roll | `Danh tướng PK` có tối đa 4 slot/ngày: miễn phí/nửa giá |
| Limited roll | Roll đột xuất, nhập riêng theo banner |
| 5 sao history | Lưu từng lần ra 5 sao: tướng, ngày, banner, lượt/slot, ghi chú |
| OCR/ảnh | Không làm phase đầu |
| Cloud sync | Không làm phase đầu; dùng export/import trước |
| Core pity 5+1 | Không đưa vào phase đầu vì không có xác nhận chính thức |

## Research Decisions

### Pity 30 và banner

Nên model pity tách theo `account + banner`. Không share pity giữa `Danh tướng PK` và `Tướng tài PK`, vì bảng xác suất official phân biệt card pack danh tướng có 5 sao, còn gói tướng tài/lương tướng không có 5 sao. Do user đã chốt bỏ `Tướng tài PK`, app chỉ cần theo dõi các banner có `hasFiveStar: true`.

### Dòng “chiêu mộ tiếp 2 lần”

Không cần đưa vào app. Đây là thông tin game đã hiển thị tại thời điểm quay; đưa thêm sẽ tạo counter riêng dễ gây nhiễu và không phục vụ mục tiêu chính là lịch sử 5 sao + pity 30.

### Gói thẻ theo giai đoạn

App nên cho user tạo banner/gói hạn giờ bằng tên tự nhập, có thể gợi ý một số tên đã đọc từ ảnh:

| Giai đoạn | Gói thẻ quan sát được |
|---|---|
| Sẵn Sàng Chiến Đấu | Kỳ Tật Như Phong |
| Hưng Động Can Qua | Kỳ Từ Như Lâm |
| Đã Đánh Là Thắng | Xâm Lược Như Lửa |
| Khí Thế Ngút Trời | Bất Động Như Sơn |
| Cử Binh Đến Nơi | Cân Bằng Tĩnh Thế |
| Tổng Kết Giữa Kỳ / Quyết Thắng Trung Nguyên | Nan Tri Như Âm |
| Quân Đến Chân Thành | Động Như Lôi Đình |

Không hard-code toàn bộ như dữ liệu chắc chắn nếu chưa đủ nguồn; chỉ dùng làm preset/gợi ý.

### Core vs tướng ít dùng

Phase đầu chỉ nên có badge giá trị tướng tùy chọn, không coi là chân lý. Label trung tính:

- `Chủ lực`
- `Dùng đội`
- `Tình huống`
- `Nội chính`
- `Vật liệu`
- `Chưa phân loại`

Không dùng chữ `rác` trong UI. Nếu data chưa đủ, record vẫn lưu được với `Chưa phân loại`.

## Recommended UX

Tab `Theo dõi chiêu mộ` gồm 4 vùng gọn:

### 1. Account Bar

- Select account.
- `+ Account`.
- Đổi tên/xóa account ở menu nhỏ.
- `Xuất JSON`, `Nhập JSON`.

Account hiện tại nên luôn rõ vì lỗi ghi nhầm account sẽ phá pity.

### 2. Danh Tướng PK - Hằng Ngày

Card chính, hiển thị:

- `Pity 5★: X/30`.
- `Còn Y lượt`.
- `Hôm nay: n/4`.
- Optional `Free sau: HH:mm` nếu user muốn nhập nhắc tay.

4 slot cố định:

| Slot | Ý nghĩa |
|---|---|
| `Miễn phí 1` | lượt miễn phí đầu |
| `Nửa giá 1` | lượt nửa giá sau miễn phí đầu |
| `Miễn phí 2` | lượt miễn phí sau cooldown |
| `Nửa giá 2` | lượt nửa giá sau miễn phí 2 |

Mỗi slot có 2 hành động:

- Tick slot: đã quay, không ra 5 sao, pity +1.
- `Ra 5★`: mở form ghi tướng, auto điền banner/slot/lượt hiện tại, rồi reset pity.

Lý do dùng slot thay vì nút `+4`: user có thể chỉ quay 2 lượt, hoặc quay 2 lượt rồi quên lượt sau do cooldown khoảng 11h30.

Slot không nên chỉ là boolean. Cần 3 trạng thái: `pending`, `miss`, `fiveStar`.

### 3. Gói Hạn Giờ / Đột Xuất

Collapsed list để không chiếm chỗ.

Mỗi banner có:

- Tên banner/gói.
- Loại: hạn giờ, mùa, giai đoạn, sự kiện.
- `Pity X/30`.
- Optional hạn giờ/ghi chú.
- Actions: `+1 không ra`, `+5 không ra`, `Ra 5★`, sửa/xóa.

Không dùng 4 daily slot ở khu này.

### 4. Lịch Sử 5 Sao

Danh sách mới nhất trước. Filter account/banner/value class.

Mỗi record hiển thị dạng:

```text
10/07 · Main · Danh tướng PK · Miễn phí 2
Lưu Bị · lượt 23/30 · Chủ lực
```

Form `Ra 5★` tối giản:

- Tướng.
- Banner.
- Slot/lượt: auto từ action, sửa được nếu cần.
- Ngày: default hôm nay.
- Ghi chú optional.

## Data Shape

### Banner metadata

```json
{
  "id": "danh-tuong-pk",
  "name": "Danh tướng PK",
  "type": "normal",
  "drawMode": "daily",
  "hasFiveStar": true,
  "pityLimit": 30,
  "dailyCheapPullLimit": 4
}
```

Limited banner:

```json
{
  "id": "banner_...",
  "name": "Kỳ Tật Như Phong",
  "type": "limited",
  "drawMode": "adHoc",
  "hasFiveStar": true,
  "pityLimit": 30,
  "expiresAt": "2026-07-11T13:40:00+07:00"
}
```

### Daily state

```json
{
  "date": "2026-07-10",
  "accountId": "acc_...",
  "bannerId": "danh-tuong-pk",
  "slots": [
    { "key": "free_1", "label": "Miễn phí 1", "status": "miss" },
    { "key": "half_1", "label": "Nửa giá 1", "status": "miss" },
    { "key": "free_2", "label": "Miễn phí 2", "status": "pending" },
    { "key": "half_2", "label": "Nửa giá 2", "status": "pending" }
  ],
  "nextFreeAt": "11:30"
}
```

### 5 sao record

```json
{
  "id": "rec_...",
  "accountId": "acc_...",
  "heroName": "Lưu Bị",
  "heroValueClass": "Chủ lực",
  "date": "2026-07-10",
  "bannerId": "danh-tuong-pk",
  "drawSlot": "free_2",
  "drawKind": "free",
  "pullCount": 23,
  "note": "",
  "createdAt": "2026-07-10T03:24:00+07:00",
  "updatedAt": "2026-07-10T03:24:00+07:00"
}
```

## Behavior Rules

- Pity tăng khi user ghi lượt không ra 5 sao.
- Khi ghi `Ra 5★`, thêm history record và reset pity của đúng `account + banner`.
- Không reset banner khác, không reset account khác.
- `pullCount` default bằng pity hiện tại + 1.
- Nếu user nhập quá 30, không tự xóa số thật; hiển thị cảnh báo `Kiểm tra lại dữ liệu/game rule`.
- Daily date dùng ngày local Việt Nam, không dùng UTC để reset slot.
- Import phase đầu là overwrite có xác nhận; trước overwrite nên khuyến khích export backup.

## Touchpoints

| File | Change expected |
|---|---|
| `index.html` | Thêm nav tab + section |
| `js/app.js` | Load/init tracker section |
| `js/recruit-tracker.js` | UI/state module mới |
| `js/recruit-tracker-store.js` | localStorage, validation, import/export |
| `css/styles.css` | Layout tab, slot buttons, banner list, history |
| `tests-js/recruit-tracker-store.test.mjs` | Unit tests store/pity/import-export |
| `README.md` | Cập nhật tính năng và lưu ý local backup |

## Acceptance Criteria

- Có tab `Theo dõi chiêu mộ`.
- Tạo, đổi, chuyển được nhiều account.
- `Danh tướng PK` có 4 slot/ngày: `Miễn phí 1`, `Nửa giá 1`, `Miễn phí 2`, `Nửa giá 2`.
- Tick slot không ra 5 sao tăng pity đúng.
- Ghi `Ra 5★` từ slot lưu đúng tướng/ngày/banner/slot/lượt/ghi chú và reset pity.
- Banner hạn giờ có thể tạo thủ công, cộng `+1`, `+5`, ghi `Ra 5★`.
- History mới nhất trước, filter được theo account/banner.
- Export JSON rồi import lại khôi phục state.
- localStorage rỗng/corrupt không làm app vỡ.
- Không có UI cho `Tướng tài PK`, counter “chiêu mộ tiếp 2 lần”, OCR, cloud sync, hoặc 5+1 core pity trong phase đầu.

## Deferred

- Upload ảnh kết quả.
- OCR nhận diện tướng.
- Cloud sync nhiều máy.
- Merge import nâng cao.
- Checklist sở hữu theo tướng.
- Curated tier/core dataset hoàn chỉnh.
- Community 5+1 core pity như feature thử nghiệm nếu sau này user vẫn muốn.

## Next Steps

1. Chạy red-team brainstorm trước implementation.
2. Nếu red-team không STOP, lập implementation plan ngắn.
3. Viết store/tests trước, sau đó UI tab.

## Unresolved Questions

- Không có câu hỏi chặn implementation. Cần chỉ chốt sau nếu muốn: import phase đầu overwrite-only hay có merge đơn giản.
