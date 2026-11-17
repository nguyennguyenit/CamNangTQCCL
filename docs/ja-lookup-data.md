# Dữ liệu tiếng Nhật cho Tra cứu (`data/lookup-ja.json`)

`data/lookup-ja.json` mang tên Nhật có trạng thái và bản dịch máy tiếng Nhật cho bảy nhóm Tra cứu (tướng, chiến pháp, trang bị, quân sư, cải tạo binh chủng, công trình, binh thư). Trang `/ja/` đọc file này cùng bốn payload Tra cứu; file không thay payload nào và không chứa chữ Việt.

## Lệnh

```bash
python3 -m pipeline.build_lookup_ja --check     # mặc định; exit 1 khi file lệch dữ liệu hiện tại
python3 -m pipeline.build_lookup_ja --write
python3 -m pipeline.build_lookup_ja --prune-orphans --write     # bỏ bản dịch mồ côi khỏi pipeline/ja-translations.json rồi ghi
python3 -m pipeline.build_lookup_ja --import-observed PATH      # dựng lại pipeline/ja-name-overrides.json
python3 -m pipeline.build_lookup_ja --export-todo DIR --batch-size 40   # chuỗi chưa dịch, theo lô [{h, zh}]
python3 -m pipeline.build_lookup_ja --ingest BATCH.json --model NAME    # nạp lô [{h, ja}], loại mục sai số liệu
```

Chỉ dùng Python stdlib. Chạy lại `--write` sau mỗi lần promote Tra cứu (đổi `data/heroes-dict.json`, `data/tactics.json`, `data/lookup-catalog.json`, `data/books-dict.json`) vì `lookupGenerationId` và `sources` phải khớp.

### Khi promote generation Tra cứu mới

Sửa chữ Trung nguồn (kể cả chữ dịch từ tiếng Việt) làm bản dịch cũ thành mồ côi: khóa sha256 của chúng không còn trong chữ nguồn hiện tại. `--check` và `--write` khi đó dừng với lỗi nêu số mục mồ côi và lệnh dọn. Người sửa dữ liệu vi/zh không cần dịch lại mới promote được:

```bash
python3 -m pipeline.build_lookup_ja --prune-orphans --write   # bỏ mục mồ côi, ghi lại pipeline/ja-translations.json và data/lookup-ja.json
python3 -m pipeline.build_lookup_ja --check
node scripts/report-ja-gaps.mjs                               # chữ mới thành "chưa dịch", liệt kê trong docs/ja-gaps.md
```

`--prune-orphans` chỉ dùng cùng `--write` và chỉ xóa mục mồ côi; bản dịch hỏng (sha lệch, sai số liệu) vẫn làm builder dừng. Lệnh dựng `data/lookup-ja.json` trong bộ nhớ trước, chỉ ghi `pipeline/ja-translations.json` và đầu ra khi dựng thành công; dừng vì lỗi thì cả hai file giữ nguyên. Trang ja hiện dòng báo thiếu cho trường chưa dịch. Dịch bù sau bằng `--export-todo` → dịch → `--ingest` → `--write`.

### Khi ID trong `pipeline/ja-name-overrides.json` không còn trong generation Tra cứu

Generation mới có thể bỏ hoặc đổi ID một mục. Override trỏ tới ID đó làm `--check`/`--write` dừng với lỗi `ID không có trong generation Tra cứu hiện tại` (hoặc `prefixedTactics có baseId không còn…`). Cách gỡ:

1. Mục bị bỏ hẳn: xóa dòng `names["<id>"]` (hoặc mục `prefixedTactics` có `baseId` đó) khỏi `pipeline/ja-name-overrides.json`.
2. Mục đổi ID: sửa `id` trong bảng quan sát (`observedSource`, hiện là `plans/reports/ja-names-observed-261117.json`) rồi chạy `--import-observed PATH`; ID không còn tự vào `skipped.unknownId` thay vì làm builder dừng. Dòng override thêm tay ngoài bảng quan sát sẽ mất khi dựng lại, nên tên mới cũng thêm vào bảng quan sát.
3. Chạy `--write`, `--check`, rồi `node scripts/report-ja-gaps.mjs`.

## Đầu vào

| File | Nội dung |
|---|---|
| `data/ja-kanji-variants.json` | Bảng ký tự `map` (phồn/giản/biến thể TW -> tự dạng Nhật). Nguồn OpenCC (Apache-2.0, commit ghi trong `source`), bỏ cặp tự ánh xạ, cộng `supplement` viết tay; `excluded` liệt kê ký tự cố ý không đổi. Python (`pipeline/shinjitai.py`) và trình duyệt đọc cùng file; vector kiểm ở `tests/fixtures/shinjitai-vectors.json`. |
| `pipeline/ja-name-overrides.json` | Tên Nhật đã quan sát theo ID: `nameJa`, `confidence` (`high`/`medium`), `sourceUrl` (nội bộ, không public), `alts`; cùng `prefixedTactics` (転・ 拓・ 精・) và `skipped`. Dựng bằng `--import-observed` từ `plans/reports/ja-names-observed-261117.json`. |
| `pipeline/ja-glossary.json` | Thuật ngữ zh -> ja dùng khi dịch; `source` là URL Nhật đã thấy hoặc `unverified`. |
| `pipeline/ja-translations.json` | `items{sha256(chữ Trung nguồn): {src, ja, model, translatedAt}}`. Chuỗi trùng chỉ dịch một lần. |
| `pipeline/han-script-chars.json` | Hai chuỗi ký tự `simplifiedOnly` (chỉ giản thể dùng) và `traditionalOnly` (chỉ phồn thể dùng), sinh từ OpenCC (STCharacters, TSCharacters, TWVariants; Apache-2.0, commit và quy tắc ghi trong `source`), chỉ khối CJK cơ bản và mở rộng A. `pipeline/han_script.py` dùng để tính `nameOriginalLang`; chỉ dùng lúc build, trình duyệt không tải. |

## Quy tắc tên

1. Khớp theo `id`, không theo mặt chữ (金城湯池 là ví dụ cùng chữ khác chiến pháp). Tên quan sát là nguồn chính.
2. `nameStatus`: `verified` khi `confidence` = `high` (gồm mọi tên từ ảnh client Nhật); tên quan sát `medium` vẫn là `name` nhưng `nameStatus` = `derived`; dòng `low` không dùng.
3. ID chưa có trong bảng quan sát: `name` = chuyển mặt chữ (`to_shinjitai`, bỏ khoảng trắng giữa chữ Latin/số và chữ Hán), `nameStatus` = `derived`.
4. Biến thể tướng (`chinese` bắt đầu bằng `SP`, `40Y`, `無雙`) viết liền tiền tố ("SP法正", "無双大喬"). Biến thể chưa có hàng quan sát lấy tiền tố + tên tướng gốc có cùng chữ Hán, trạng thái theo tướng gốc.
5. Dòng có tiền tố 転・ 拓・ 精・ (`id: null`, `baseId`) không đè tên chiến pháp gốc; lưu ở `prefixedTactics` để trang hiển thị chiến pháp kịch bản.
6. Ký tự cố ý giữ dạng phồn thể trong tên riêng: 禦, 龍, 當, 聯, 挾, 填 (đối chiếu bảng quan sát); `眾→衆`, `溯→遡`, `弒→弑`, `據→据` thuộc `supplement`. Không sinh cách đọc kana.

## Hợp đồng đầu ra

```json
{
  "schemaVersion": 1,
  "lookupGenerationId": "lookup:<64-hex>",
  "sources": {"data/heroes-dict.json": "<sha256>", "data/tactics.json": "…", "data/lookup-catalog.json": "…", "data/books-dict.json": "…", "data/ja-kanji-variants.json": "…"},
  "notice": {"machineTranslated": true, "numbersEdition": "cn-mainland"},
  "payloadSha256": "<sha256 của entries + prefixedTactics>",
  "prefixedTactics": [{"baseId": "tactic:…", "name": "転・刮骨療毒", "prefix": "転"}],
  "entries": {"tactic:an-ui-quan-dan": {"name": "慰撫軍民", "nameStatus": "derived", "nameOriginal": "撫輯軍民", "nameOriginalLang": "zh-Hant", "texts": {"effect": "…", "target": "…"}, "translatedFromVi": ["effect"]}}
}
```

- Mọi ID của bảy nhóm đều có `name`, `nameStatus`, `nameOriginal` (chữ Hán nguồn; binh thư dùng tên phồn thể trong `sourceNames` nếu có). ID gồm cả đặc kỹ trang bị (`equipment-special:*`) và lựa chọn cải tạo (`troop-option:*`).
- `nameOriginalLang` là `lang` của dòng 原名, tính lúc build theo lối viết của `nameOriginal`: chỉ có chữ riêng của giản thể thì `zh-Hans` (ví dụ 白马替主), chỉ có chữ riêng của phồn thể thì `zh-Hant`; không có chữ phân biệt được hoặc lẫn cả hai (ví dụ 金丹秘術, vì OpenCC coi 秘 là giản thể) thì `zh`. Trường không bắt buộc với bộ kiểm của trình duyệt: vắng thì trang dùng `zh`.
- `texts` chỉ chứa khóa đã dịch; khóa vắng nghĩa là chưa có bản dịch và trang hiện dòng báo thiếu. Không bao giờ bịa nội dung.
- `translatedFromVi` liệt kê khóa mà chữ Hán nguồn vốn dịch từ tiếng Việt (điều kiện tướng, các hiệu ứng `effectZhSource.kind = "translation"`, `zhSource.kind = "translation"`); trang gắn thêm câu báo "dịch từ tiếng Việt".
- Không có `sourceUrl`, `confidence`, `model`, chữ nguồn hay sha từng chuỗi trong output (giữ nguyên tắc DTO công khai không mang provenance, xem [unified-lookup.md](unified-lookup.md)).

### Bảng khóa `texts` (`collect_texts` trong builder, khớp trường chữ Hán mà `/zh/` đang hiển thị)

| Nhóm | Khóa |
|---|---|
| Tướng | `usage`, `exclusiveTitle`, `roleTag`, `conditions.N`, `cardPacks.N.pack`, `cardPacks.N.category` |
| Chiến pháp | `effect` (gồm các bản cập nhật nối bằng ` / `), `target` |
| Quân sư | `effect`, `usage` |
| Cải tạo binh chủng | `effect`, `appliesTo`, `suggestedBuild` |
| Lựa chọn cải tạo (`troop-option:*`) | `description` |
| Công trình | `summary`, `levels.N.effect`, `levels.N.duration` |
| Binh thư | `effect` |

Trang bị và đặc kỹ không có chữ Trung mô tả nên chỉ có tên.

## Chính sách dịch máy

- Dịch từ chữ Trung, không từ chữ Việt; dùng `ja-glossary.json`; chữ Hán trong bản dịch qua `to_shinjitai` khi nạp.
- Số liệu phải bảo toàn: dãy số (kể cả thập phân), `%`, `→` trong bản dịch trùng nguyên thứ tự với nguồn. Mục sai bị loại ở bước `--ingest`, không sửa tay số; builder dừng nếu file dịch còn mục sai, mồ côi hay sha lệch (mục mồ côi dọn bằng `--prune-orphans --write`).
- Trang gắn nhãn 機械翻訳 và dòng "数値は中国大陸版に基づく". Một số thuật ngữ trạng thái trong glossary còn `unverified` (威圧, 計窮, 迷い, 追撃戦法…) và cần người dùng game Nhật soát.
- Không chép mô tả của bên thứ ba: nguồn Nhật chỉ cung cấp tên (dữ kiện) và URL nội bộ.
