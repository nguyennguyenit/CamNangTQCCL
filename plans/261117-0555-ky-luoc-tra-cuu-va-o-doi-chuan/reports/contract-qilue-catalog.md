# Hợp đồng dữ liệu nhóm Tra cứu Kỳ lược (Phase 2)

Nhóm Tra cứu: key `qilue`, slug `ky-luoc`. Cả hai đã có trong `js/lookup-ids.js` (`LOOKUP_GROUP_SLUGS.qilue = "ky-luoc"`, `GROUP_BY_KIND["qilue-strategy"|"qilue-card"] = "qilue"`).

## Input (đã có, commit 33128af)

`pipeline/lookup-client-tactics.json` có 3 nhóm khóa liên quan:

- `qilueSource` (cùng shape với `source`), `qilueStrategies` (5 mục), `qilueCards` (40 mục). Mỗi mục là `{"<id>": {...}}`.
- `zhTexts["qilue-card:*"].effectZh`, `zhTexts["qilue-strategy:*"].descriptionZh` và `.buffZh`. Đây là bản dịch từ tiếng Việt, có `viSha256`.
- Hàm đọc: `pipeline/build_unified_lookup.py::_client_qilue(document) -> (strategies, cards)`.

## Output trong `data/lookup-catalog.json`

Catalog có thêm 2 khóa, đều là mảng row phẳng sắp theo `id`.

`qilueStrategies[]`
```json
{"id": "qilue-strategy:muu-tinh", "nameVi": "Mưu tính", "aliasesVi": ["Mưu Toán"], "nameZh": "謀算", "aliasesZh": ["謀算"],
 "conditions": [{"kind": "season", "textVi": "Mùa Hán Diễm Trường Minh (PK-S27, client 24.547)", "textZh": "漢焰長明賽季（PK-S27，客戶端 24.547）"}],
 "missingFields": [], "cardTypes": ["muu", "phu"], "descriptionVi": "…", "buffVi": "…", "descriptionZh": "…", "buffZh": "…",
 "zhSource": {"kind": "translation"}}
```

`qilueCards[]`
```json
{"id": "qilue-card:bo-tri-thap-dien", "nameVi": "Bố Trí Thập Diện", "aliasesVi": [], "nameZh": "設伏十面", "aliasesZh": ["設伏十面"],
 "conditions": [ …như trên… ], "missingFields": [], "type": "muu", "rarity": "common",
 "targetVi": "Nhóm quân ta", "effectVi": "…", "effectZh": "…", "zhSource": {"kind": "translation"}}
```

Bất biến:
- `aliasesZh` luôn là `[nameZh]`. Biến thể chữ Hán sai không bao giờ có trong catalog.
- `type` là một trong `dung | muu | phu | sach | te`. `rarity` là `common | rare`.
- `targetVi` chỉ nhận 5 giá trị: "Toàn quân ta", "Một quân ta", "Nhóm quân ta", "Một quân địch", "Toàn quân địch".
- Danh sách phương lược dùng được một thẻ là các strategy có `cardTypes` chứa `type` của thẻ. Danh sách này tính ra lúc hiển thị, không lưu trong row.
- Va chạm tên với nhóm khác chỉ được phép trong allowlist: "Ám Độ Trần Thương" (tactic:lap-lo-danh-trao), "Cường Công" và "強攻" (tactic:cuong-cong). Kết quả tìm kiếm phải ghi nhãn nhóm.

## Nhãn

| Mã | vi | zh |
|---|---|---|
| nhóm | Kỳ lược | 奇略 |
| dung / muu / phu / sach / te | Dũng / Mưu / Phụ / Sách / Tế | 勇 / 謀 / 輔 / 策 / 濟 |
| common / rare | Thường / Hiếm | 普通 / 稀有 |
| Toàn quân ta / Một quân ta / Nhóm quân ta | (giữ) | 我軍全體 / 我軍單體 / 我軍群體 |
| Một quân địch / Toàn quân địch | (giữ) | 敵軍單體 / 敵軍全體 |
| phương lược / thẻ | Phương lược / Thẻ kỳ lược | 作戰方略 / 奇略卡 |

## Ghi chú môi trường
- `data/*` chưa có 2 khóa mới. Generation sẽ được promote và publish ở Phase 6.
- Cho tới lúc đó, test đọc `data/` thật (dist, e2e) sẽ fail vì dữ liệu cũ. Unit test phải dùng fixture.
- Hook Bash chặn lệnh chứa chữ `build`, `dist`, `node_modules`. Gọi qua `npm run <script>` hoặc dùng công cụ Read/Grep.
