---
type: red-team-brainstorm-report
date: 2026-07-10
topic: chieu-mo-tuong-vang-tracker
status: caution
skill: ck:predict
---

# Red-Team Brainstorm: Theo dõi chiêu mộ tướng vàng

## Verdict: CAUTION

Thiết kế local-first là hợp lý và đủ nhỏ để implement. Không có STOP issue. Các rủi ro chính nằm ở tính nhất quán pity khi user sửa dữ liệu cũ, dùng nhiều máy bằng `localStorage`, và nhầm account/banner. Nếu phase đầu giữ scope chặt, feature nên đi tiếp.

## Persona Agreements

- Nên giữ phase đầu local-first, không cloud sync/OCR.
- Bỏ `Tướng tài PK` là đúng vì không phục vụ tracker 5 sao.
- Daily roll cần slot-level tracking, không chỉ nút `+4`.
- Pity phải tách theo `account + banner`.
- Import/export JSON là bắt buộc nếu dùng `localStorage`.
- `5+1 core pity` không nên xuất hiện như guarantee trong UI.

## Conflicts & Resolutions

| Topic | Architect | Security/Data | Performance | UX | Devil's Advocate | Resolution |
|---|---|---|---|---|---|---|
| Event log vs stored pity | Muốn event log để derive state | Stored pity dễ lệch khi edit | Event log nhỏ, không đáng lo | Stored pity dễ hiểu hơn | Đừng overbuild | Lưu pull events tối thiểu hoặc giữ stored pity nhưng tests edit/delete kỹ. Ưu tiên event-derived nếu code vẫn gọn |
| Import behavior | Merge-ready schema tốt | Overwrite có thể mất data | Merge không nặng nhưng thêm logic | Overwrite dễ hiểu | Merge phase đầu chưa cần | Phase đầu overwrite có confirm + nhắc export backup; schema vẫn có id/timestamp để merge sau |
| Hero value badge | Badge giúp lọc core | Sai tier gây quyết định sai | Không ảnh hưởng | User thích biết core/vật liệu | Có thể thành feature tranh cãi | Badge optional, source/date rõ, default `Chưa phân loại`; không chặn ghi record |
| Limited banner countdown | Metadata đẹp | Relative time có thể sai | Countdown interval không đáng kể | Có hạn giờ thì hữu ích | User đọc trong game được | Store `expiresAt` optional; không biến countdown thành requirement |
| Edit old slot | Consistency phức tạp | Có thể phá lịch sử | Không đáng kể | User cần sửa sai | Hạn chế sửa để giảm lỗi | Cho sửa record/history; với slot đã ảnh hưởng pity sau 5 sao, cảnh báo hoặc recompute từ event log |

## Risk Summary

| Risk | Severity | Mitigation |
|---|---|---|
| User ghi nhầm account | High | Account bar nổi bật/sticky, record hiển thị account rõ, filter mặc định theo active account |
| Pity lệch khi edit/delete record cũ | High | Dùng event log derive pity, hoặc recompute toàn bộ state sau mỗi edit/delete |
| localStorage mất khi đổi máy/browser/xóa cache | High | Export/import rõ, CTA backup, không lưu ảnh trong storage |
| Import overwrite làm mất data hiện tại | Medium | Confirm 2 bước nhẹ: “Xuất backup trước” + “Ghi đè”; validate schema trước khi ghi |
| Daily slot reset sai do timezone | Medium | Dùng local date `Asia/Ho_Chi_Minh`/local browser date, tránh UTC ISO date cho key ngày |
| `+5 không ra` vượt 30 | Medium | Cho phép lưu số thật, hiển thị warning thay vì hard cap |
| Banner limited share pity không chắc | Medium | Default tách banner; cho user chỉnh/reset pity thủ công |
| Data tướng thiếu tướng mới | Medium | Hero input cho phép free text nếu không tìm thấy trong data |
| Core/vật liệu bị hiểu là official tier | Medium | Label trung tính, optional, có `Chưa phân loại` |
| UI quá nhiều nút trên mobile | Medium | 4 vùng gọn, actions chính lớn, limited banner collapsed |
| Corrupt JSON/localStorage làm app trắng | Medium | Safe parse, fallback default, error banner |
| Scope creep sang OCR/cloud/reminder | Medium | Explicit deferred; không thêm code nền cho các feature này phase đầu |

## Red-Team Findings

### 1. Pity consistency is the hardest part

Nếu chỉ lưu `pullsSinceFiveStar` rồi cho user sửa/xóa history, state dễ sai. Ví dụ user tick 4 slot, sau đó ghi 5 sao ở slot 2, rồi untick slot 1. Nếu không recompute, pity/history không còn đáng tin.

Recommendation: model mỗi hành động quay là event nhỏ:

```json
{
  "id": "evt_...",
  "accountId": "acc_...",
  "bannerId": "danh-tuong-pk",
  "date": "2026-07-10",
  "drawSlot": "free_2",
  "pulls": 1,
  "result": "fiveStar",
  "heroName": "Lưu Bị"
}
```

Sau đó derive pity/history từ events. Nếu muốn code ngắn hơn, vẫn có thể lưu pity trực tiếp, nhưng mọi edit/delete phải chạy `recomputePity(accountId, bannerId)`.

### 2. `localStorage` is not sync

User muốn dùng điện thoại và PC. Export/import giải quyết backup thủ công nhưng không phải sync. App copy cần nói rõ bằng UI text ngắn: dữ liệu lưu trên trình duyệt này, muốn chuyển máy thì xuất/nhập JSON.

Không nên làm cloud sync phase đầu vì sẽ kéo auth, conflict, backend, privacy.

### 3. Daily 4-slot design is correct

Nút `+4` sẽ tạo lỗi thực tế vì user có thể chỉ quay 2 lượt, hoặc quên lượt sau cooldown. Slot cố định là quyết định đúng.

Refinement: mỗi slot nên có state rõ:

- Chưa quay.
- Đã quay, không ra 5 sao.
- Ra 5 sao.

Không chỉ boolean `done`.

### 4. Limited banners need manual control

Không đủ bằng chứng để hard-code mọi banner/gói và rule share pity. Nên default tách pity từng banner. Cho user tạo/sửa banner, chỉnh pity ban đầu nếu họ đã quay trước khi bắt đầu dùng app.

### 5. Hero selector must allow unknown heroes

Repo hiện thiếu một số tướng mới user nhắc tới như `SP Mã Siêu`, `SP Quan Vũ`. Nếu selector bắt buộc chọn từ `heroes-dict.json`, app sẽ fail đúng case user cần.

Recommendation: autocomplete từ data, nhưng cho free-text và lưu `heroNameRaw`.

### 6. Core/material classification should be low authority

Không có nguồn official cho “core” vs “vật liệu”. Có thể dùng team data nội bộ và research cộng đồng làm hint, nhưng UI phải tránh khẳng định chắc. Badge nên là metadata sửa được, không quyết định logic.

### 7. Import needs validation before write

Nhập JSON lỗi không được làm mất dữ liệu hiện tại. Flow:

1. User chọn file.
2. Parse + validate schema in memory.
3. Hiện summary: số account, banner, records.
4. User confirm overwrite.
5. Ghi localStorage.

## Implementation Guardrails

- Không thêm `Tướng tài PK`.
- Không thêm counter “chiêu mộ tiếp 2 lần”.
- Không thêm 5+1 core pity.
- Không lưu ảnh base64 vào `localStorage`.
- Không dùng UTC date làm daily key.
- Không để hero select khóa user vào data hiện có.
- Không hard cap pity tại 30; warning thôi.
- Không để import ghi đè trước khi validate.

## Recommended Acceptance Additions

- Test recompute pity sau khi xóa/sửa record 5 sao.
- Test active account không ảnh hưởng account khác.
- Test daily slot qua ngày mới reset slot nhưng giữ pity.
- Test corrupt `localStorage` fallback default.
- Test import JSON invalid không ghi đè data cũ.
- Test free-text hero lưu được khi không có trong `heroes-dict.json`.

## Final Recommendation

Proceed with CAUTION. Thiết kế nên đi tiếp nếu implementation ưu tiên store/event logic trước UI. UX có thể rất gọn nếu daily roll là card chính, limited roll collapsed, history là bảng/list đơn giản.

## Unresolved Questions

- Import phase đầu giữ overwrite-only hay thêm merge đơn giản ngay? Red-team khuyến nghị overwrite-only có backup/confirm.
