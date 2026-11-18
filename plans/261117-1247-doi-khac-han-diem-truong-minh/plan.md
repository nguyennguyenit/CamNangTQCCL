# Đội khác mùa Hán Diễm Trường Minh (PK-S27)

Issue: nguyennguyenit/CamNangTQCCL#123. Branch tích hợp: `feat/doi-khac-han-diem-truong-minh`
(worktree `/Users/plateau/Project/CamNangTQCCL-wt-doi-khac`).

## Kết quả

Đội khác = danh sách đội đánh được của riêng mùa PK-S27, không trùng tuyệt đối (tướng + chiến pháp)
với Đội chuẩn PK-S27. Nguồn: research YouTube (đội đề cử, đứng đầu) + sheet cộng đồng.

## Hợp đồng dữ liệu chung

### `pipeline/team-youtube-pk-s27.json` (mới, curate tay)

```json
{
  "_note": "...",
  "sourceSeasonId": "pk-s27",
  "teams": [
    {
      "source": "youtube",
      "name": "<tên Việt>", "nickname": null, "nameZh": "<tên creator gốc>",
      "rawType": "Khiên", "unitType": ["Khiên"], "faction": null, "stars": null, "status": "meta",
      "heroes": [
        {"name": "40Y Lữ Bố", "baseName": "...", "alternatives": [], "variant": null, "isSP": false, "isCO": false,
         "tactics": [{"name": "<tên Việt tactics.json>", "alternatives": []}],
         "books": [{"name": "<binh thư Việt>", "alternatives": []}], "note": null}
      ],
      "counters": {"good": [], "avoid": []}, "notes": null,
      "confidence": "cao",
      "evidence": [{"videoId": "khGmfKDo9ng", "at": "001m16s", "kind": "đề cử"}]
    }
  ]
}
```

- Bản ghi đã chuẩn hóa như `pipeline/team-intro-supplement.json` (không có `id`). Tướng thứ nhất = chủ tướng.
- Tên tướng = `hanViet` trong `data/heroes-dict.json`; chiến pháp = tên Việt trong `data/tactics.json`;
  binh thư = bảng thủ công `pipeline/books-han-viet-map.json` (không auto-link).
- Chiến pháp không đọc được: bỏ khỏi `tactics`, ghi `note` của tướng "Chiến pháp chưa đọc được từ video".

### `data/teams.json`

- `build_json` nối nguồn YouTube sau supplement, ID `youtube-<n>`, giữ `nameZh`, `confidence`, `evidence`.
- Tab "Team giới thiệu(mới)": kỳ vọng 60 đội (trước 50).

### Ledger `pipeline/recommended-other-teams.json` và public `other-teams.json`

- Corpus dedup = chỉ bản ghi Đội chuẩn có `sourceSeasonId == defaultSourceSeasonId` (`pk-s27`).
- Mọi hàng admitted: `sourceSeasonIds: ["pk-s27"]`.
- Thêm `recommended: true` cho nguồn YouTube (false cho nguồn khác); `sourceLabel` nguồn YouTube = "YouTube".
- Thứ tự admitted: đội `recommended` trước, rồi thứ tự cũ.

### Giao diện `/doi-khac/`

- Không còn ô chọn mùa; hiện cố định "Mùa Hán Diễm Trường Minh" (lấy tên mùa từ `seasons.json`, không hard-code).
- `?season=` bất kỳ không làm hỏng trang (bỏ qua).
- Hàng `recommended`: nhãn "Đề cử" (zh 推荐) trên thẻ, thẻ gọn, bảng, trang chi tiết; xếp đầu.

## Piece

| Piece | Sở hữu | Trạng thái |
|---|---|---|
| A. Curate đội YouTube | `pipeline/team-youtube-pk-s27.json` | wave 1 |
| B. Pipeline: sheet + nguồn YouTube + dedup mùa + identity map + test Python | `pipeline/*.py`, `data/teams.json`, `data/facets.json`, identity map, ledger, `tests/` | wave 1 |
| C. Giao diện một mùa + Đề cử | `js/`, `src/lib/team-section-ssr.js`, `src/components`, `tests-js/`, `tests-e2e/` | wave 1 |
| D. Dịch + receipt + publish generation + rebind handle | localization files, `src/data/recommended-reference`, handles | sau A, B, C |
| E. Docs, test đầy đủ, PR, review độc lập | docs | cuối |
