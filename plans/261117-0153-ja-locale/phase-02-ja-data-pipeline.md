# Phase B — Dữ liệu ja: shinjitai, tên Nhật có trạng thái, dịch máy mô tả

Branch: `feat/ja-locale-b-ja-data`. Phụ thuộc: không. Chạy song song với A, D, E1, F, G. Effort 20h (công cụ 6h, đối chiếu tên 6h, dịch + kiểm 8h). Rủi ro: trung bình. Không sửa `src/`, `js/`.

## Bối cảnh

- Tên chữ Hán nguồn của tướng/chiến pháp nằm ở trường `chinese` (phồn thể SGSDeck, ví dụ `"SP 呂蒙"` trong `data/heroes-dict.json`), `aliases` chứa thêm giản thể; catalog dùng `aliasesZh`/`nameZh` (`docs/unified-lookup.md`, mục "Trường zh công khai của catalog"); binh thư dùng `chinese` trong `data/books-dict.json`.
- Văn bản Trung mà hồ sơ `/zh/` hiển thị (đếm từ dữ liệu hiện tại): `tactics[].effect` 422 mục (~41.700 ký tự), `tactics[].target` 276 mục (20 chuỗi khác nhau), `heroes[].lookup.usageZh` 94, `lookup.conditions[].textZh` 35 (4 chuỗi khác nhau; vốn là chữ Hán dịch từ tiếng Việt), `lookup.exclusiveTitleZh` 36, `roleTag` 261 (49 khác nhau), `cardPacks[].packZh/categoryZh` (22 khác nhau); catalog: `advisors[].effectZh` 59, `usageZh` 27, `nameZh` 20, `buildings[].summaryZh` 41, `levels[].effectZh` 426, `levels[].durationZh` 423 (70 khác nhau), `troopMods[].effectZh` 16, `appliesToZh` 12, `suggestedBuildZh` 12, `options[].nameZh` 192, `options[].descriptionZh` 192; `books[].effect` 68. Tổng khoảng 75.000 ký tự, ước khoảng 2.500 chuỗi khác nhau.
- Tên cần cho Tra cứu `/ja/`: 263 tướng, 422 chiến pháp, 114 trang bị, 90 đặc kỹ, 59 quân sư, 16 cải tạo + 192 lựa chọn, 41 công trình, 68 binh thư (khoảng 1.265 tên).
- Quy ước pipeline: Python stdlib, JSON deterministic UTF-8 có newline cuối, fail-loud (`docs/code-standards.md`, mục "Python pipeline").
- Nguồn Nhật đã đánh giá: Kazten (bài chữ theo mùa), Shinsen Navi, Chousen; Hensei Kobo **không** dùng hàng loạt (issue #113, mục "Quyết định nguồn"); tên JP và TW có thể khác nghĩa, ví dụ 軍陣結集 (JP) và 魔軍結陣 (TW) (`plans/reports/research-261015-japanese-content-sources.md` ở checkout chính).

## Thiết kế dữ liệu

### Đầu vào (đã review, commit)

| File | Nội dung |
|---|---|
| `data/ja-kanji-variants.json` | Bảng ký tự `{từ: đến}` phồn thể/biến thể TW → shinjitai. Nguồn: `JPVariants` (kyūjitai → shinjitai) và `TWVariants` (biến thể TW → phồn thể chuẩn) của OpenCC, cộng phần bổ sung viết tay của dự án (ví dụ 吳→呉, 黃→黄, 內→内, 說→説, 稅→税, 銳→鋭). Có trường `source`, `license`, `supplement`. Đặt ở `data/` vì phase C cần cùng bảng ở trình duyệt (đổi tên đội Đội chuẩn, tên thô chưa khớp từ điển); Python và JS đọc **cùng một file**. |
| `pipeline/ja-name-overrides.json` | Theo ID: `{nameJa?, refs[], note}`. Có `nameJa` = tên Nhật khác kết quả chuyển mặt chữ (ngoại lệ); không có `nameJa` nhưng có `refs` = tên chuyển mặt chữ đã thấy trong nguồn Nhật. `refs` là URL https cụ thể + ngày xem; không public. |
| `pipeline/ja-glossary.json` | Thuật ngữ zh → ja dùng khi dịch (兵刃伤害, 谋略伤害, 统率, 智力, các trạng thái như 震慑, 计穷…), mỗi mục có nguồn Nhật hoặc ghi `unverified`. |
| `pipeline/ja-translations.json` | Kho dịch máy **định địa chỉ theo nội dung**: `{sha256(chữ nguồn UTF-8): {src, ja, model, translatedAt}}`. Chuỗi trùng nhau dịch một lần; chữ nguồn đổi thì sha đổi → mục thành thiếu (hiện dòng báo thiếu, vào `docs/ja-gaps.md`), mục cũ thành mồ côi → builder dừng cho tới khi dọn hoặc dịch lại. |

### Đầu ra (public)

`data/lookup-ja.json` (phẳng dưới `data/`, vì route `/data/[file].json` và kiểm đường `^data\/[^/]+\.json$` ở `js/website-display.js:120` chỉ nhận một cấp):

```json
{
  "schemaVersion": 1,
  "lookupGenerationId": "<generationId của data/lookup-manifest.json>",
  "sources": {"data/heroes-dict.json": "<sha256>", "data/tactics.json": "<sha256>", "data/lookup-catalog.json": "<sha256>", "data/books-dict.json": "<sha256>", "data/ja-kanji-variants.json": "<sha256>"},
  "notice": {"machineTranslated": true, "numbersEdition": "cn-mainland"},
  "entries": {
    "hero:sp-lu-mong": {"name": "SP 呂蒙", "nameStatus": "derived", "texts": {"usage": "…"}},
    "tactic:…": {"name": "…", "nameStatus": "verified", "texts": {"effect": "…", "target": "…"}},
    "building:…": {"name": "…", "nameStatus": "derived", "texts": {"summary": "…", "levels.0.effect": "…", "levels.0.duration": "…"}}
  }
}
```

- Mọi ID có trong bốn payload Tra cứu đều có `name` (không bao giờ thiếu tên): `nameJa` của override nếu có, không thì `shinjitai(tên chữ Hán nguồn)`; `nameStatus = "verified"` khi override có `refs`, ngược lại `"derived"`. Không sinh kana.
- `texts` chỉ chứa khóa đã dịch; khóa vắng = thiếu bản dịch. Bảng khóa theo nhóm (`FIELD_SPEC` trong builder) liệt kê tường minh trường nguồn → khóa ja, khớp đúng danh sách trường zh đang hiển thị; phase C đọc cùng bảng khóa (mô tả trong `docs/ja-lookup-data.md`).
- Không đưa `refs`, `model`, chữ nguồn hay sha vào output (giữ nguyên tắc DTO công khai không mang provenance, `docs/unified-lookup.md`, mục "Phạm vi và nguồn truth").

### Mã

| File | Vai trò |
|---|---|
| `pipeline/shinjitai.py` | `to_shinjitai(text)`: đổi từng ký tự theo `data/ja-kanji-variants.json`, giữ nguyên ký tự không có trong bảng (chữ không thuộc thường dụng giữ dạng cũ, ví dụ 劉, 龐), giữ chữ Latin/số/khoảng trắng. |
| `pipeline/build_lookup_ja.py` | CLI `--write` / `--check` (mặc định check; exit 1 khi `data/lookup-ja.json` lệch dữ liệu hiện tại). Kiểm: ID override/translation phải tồn tại; override `nameJa` khác kết quả chuyển mặt chữ phải có `refs`; mục dịch mồ côi; số liệu bảo toàn (mọi dãy số, `%`, `→`, `x→y` trong nguồn phải có mặt đủ và đúng thứ tự trong bản ja); không HTML/thực thể/ký tự điều khiển; `lookupGenerationId` và `sources` khớp file hiện tại. |
| `tests/test_shinjitai.py`, `tests/test_build_lookup_ja.py` | Unit + vector; dùng `tests/fixtures/shinjitai-vectors.json` (cặp đầu vào/kết quả, cả TW biến thể) — cùng file vector cho bộ chuyển JS ở phase C. |
| `docs/ja-lookup-data.md` | Hợp đồng dữ liệu ja, lệnh dựng lại, trigger (sau mỗi lần promote Tra cứu), cách thêm ngoại lệ, chính sách dịch máy. |

## Bước (TDD)

1. Kiểm giấy phép và nội dung `JPVariants.txt`/`TWVariants.txt` của OpenCC (Apache-2.0) trước khi vendor; ghi nguồn + phiên bản + license vào header file bảng. Nếu chủ repo không đồng ý vendor (Q7), dựng bảng từ danh sách 旧字体/新字体 của 常用漢字表 + 人名用漢字 và ghi nguồn tương ứng.
2. Viết `tests/fixtures/shinjitai-vectors.json` (khoảng 60 cặp: tên tướng/chiến pháp phổ biến, chữ biến thể TW, chữ không đổi) và `tests/test_shinjitai.py` → đỏ; viết `pipeline/shinjitai.py` + bảng → xanh.
3. Viết `tests/test_build_lookup_ja.py` với fixture nhỏ (ID lạ, override thiếu refs, mồ côi, số liệu lệch, output deterministic, `--check` phát hiện lệch) → đỏ; viết builder → xanh.
4. **Đối chiếu tên Nhật (research):** thu danh sách tên tướng/chiến pháp/binh thư/trang bị xuất hiện trong nguồn Nhật được phép (Kazten, Shinsen Navi, Chousen, trang chính thức 三國志 真戦 nếu có 図鑑 hoặc bài tướng mới), chỉ lấy tên (dữ kiện), không chép mô tả. So với kết quả chuyển mặt chữ: trùng → ghi `refs`; khác → ghi `nameJa` + `refs` + `note`. Báo cáo độ phủ (số `verified`/tổng theo nhóm) vào `plans/261117-0153-ja-locale/reports/ja-name-coverage.md`. Một reviewer độc lập (sub-agent khác) soát ngẫu nhiên tối thiểu 10% mục `nameJa` và mọi mục khác nghĩa (kiểu 軍陣結集).
5. **Dịch máy:** dựng danh sách chuỗi nguồn khác nhau theo `FIELD_SPEC`, dịch theo lô (khoảng 100 chuỗi/lô) từ **chữ Trung** sang tiếng Nhật, áp `pipeline/ja-glossary.json`, giữ nguyên số liệu; ghi `model` = tên model thực hiện. Không dịch từ chữ Việt. Mục `conditions[].textZh` và hiệu ứng có `effectZhSource.kind = "translation"` vốn là chữ Hán dịch từ tiếng Việt: vẫn dịch từ chữ Hán đó nhưng builder xuất cờ để C gắn thêm câu "中国語訳（ベトナム語から）からの機械翻訳" (chốt chữ ở C).
6. Builder kiểm số liệu từng mục; mục lỗi bị loại (thành thiếu) và liệt kê trong báo cáo, không sửa tay số.
7. Reviewer độc lập soát ngẫu nhiên 5% bản dịch (ưu tiên chiến pháp S, quân sư) về nghĩa và thuật ngữ; ghi kết quả vào `plans/261117-0153-ja-locale/reports/ja-translation-review.md`.
8. `python3 -m pipeline.build_lookup_ja --write`, rồi `--check`; `python3 -m unittest discover -s tests`.

## Cách kiểm

| Loại | Nội dung |
|---|---|
| Unit | `test_shinjitai`, `test_build_lookup_ja` (vector, override, mồ côi, số liệu, deterministic) |
| Dữ liệu | `--check` xanh; mọi ID trong bốn payload có `name`; đếm `verified`/`derived` và số khóa `texts` theo nhóm trong báo cáo |
| Review | Báo cáo độ phủ tên + báo cáo soát dịch của reviewer độc lập |

## Rủi ro

| Rủi ro | Khả năng × Tác động | Giảm thiểu |
|---|---|---|
| Tên chuyển mặt chữ sai với tên chính thức JP (khác nghĩa, không chỉ khác tự dạng) | Cao × Trung bình | Trạng thái `derived` hiển thị rõ; ưu tiên đối chiếu chiến pháp sự kiện/mùa mới; tên gốc luôn hiện cạnh |
| Dịch máy đổi số hoặc nghĩa (連戦率 không phải tỷ lệ thắng, issue #10) | Trung bình × Cao | Kiểm số tự động, glossary, soát mẫu độc lập, nhãn 機械翻訳 |
| Bảng OpenCC thiếu biến thể TW | Trung bình × Thấp | Vector test + phần bổ sung viết tay; ký tự không có trong bảng giữ nguyên |
| `data/lookup-ja.json` cũ sau khi promote Tra cứu mới | Cao × Trung bình | `lookupGenerationId` + `sources` khớp hoặc build dừng (C nối vào `npm run verify`); trigger ghi trong `docs/ja-lookup-data.md` |
| Điều khoản nguồn Nhật | Thấp × Trung bình | Chỉ lấy tên (dữ kiện) và URL tham chiếu nội bộ, không chép mô tả; Hensei Kobo loại |

## Rollback

Xoá các file mới của B (không có file cũ nào bị sửa). `data/lookup-ja.json` chưa được trang nào đọc cho tới khi C ghép.

## Done khi

`python3 -m pipeline.build_lookup_ja --check` xanh, test Python xanh, mọi ID có tên Nhật + trạng thái, báo cáo độ phủ tên và soát dịch đã có, `docs/ja-lookup-data.md` mô tả hợp đồng mà C và D dùng.
