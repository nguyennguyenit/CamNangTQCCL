# Phase H — Ghép, ghim lại localization, full gate, docs, PR, review độc lập

Branch: `feat/ja-locale` (người ghép duy nhất). Phụ thuộc: mọi phase. Effort 8h. Rủi ro: trung bình.

## Thứ tự ghép

| Bước | Ghép | Cổng sau khi ghép |
|---:|---|---|
| 1 | A | Ghim lại localization; build; `compare` với baseline = 0 khác; full gate |
| 2 | B | `python3 -m pipeline.build_lookup_ja --check`; `python3 -m unittest discover -s tests` |
| 3 | C (C2 + C3 trước, C1 cuối) | Ghim lại localization; `lookup_route_handles --write/--check`; build; `compare --allow-locale ja` + allowlist bốn file dùng chung; full gate |
| 4 | D1, rồi D2 | Ghim lại localization (vì `worker/src/schema.ts`); `worker` test/typecheck; parity locale |
| 5 | E1, rồi E2 | Ghim + publish (generation mới có `--jp-tiers`); `team_route_handles --rebind/--check`; diff có chủ đích của trang Đội chuẩn được liệt kê |
| 6 | G (nếu Q1 = G-A) | `community-worker` test/typecheck |
| 7 | F | Kiểm danh sách trong `articles/README.md` |
| 8 | Docs + PR | Mục dưới |

## Ghim lại localization sau mỗi lần ghép

Mọi branch phase sửa file trong `policy.sourceFiles` (73 file, `pipeline/site-localization-policy.json`) đều có commit cuối riêng `chore(data): ghim lại hash nguồn`. Khi ghép: bỏ commit đó (hoặc chấp nhận rồi ghi đè), **không** merge tay policy, `src/data/recommended-reference/**`, `data/website-display.json`, `pipeline/team-route-handles.json`; chạy lại đúng chuỗi ở `docs/deployment-guide.md:303-320`:

1. Ghim `sha256_hex` mới của mọi file nguồn đã đổi vào `policy.sourceFiles`; cập nhật `baseline.notes` nếu `inventory` báo số khác.
2. `python3 -m pipeline.site_localization build --root . --stage all --output .cache/site-localization-candidate` → `check --stage all --candidate …` → `publish --candidate …` → `check --stage public` → `prune`.
3. `python3 -m pipeline.team_route_handles --rebind` rồi `--check`; `python3 -m pipeline.lookup_route_handles --check` (sau C: `--write` trước).
4. `npm run build && npm run verify && npm run test:dist`.
5. Khởi động lại dev server nếu đang chạy (pin nằm trong bộ nhớ).

## Full gate (README, mục Kiểm thử)

`npm run check`, `npm run build`, `npm run test:dist`, `npm run verify` (gồm `report-zh-gaps --check` và `report-ja-gaps --check`), `npm run test:e2e`, `npm run test:node`, `python3 -m unittest discover -s tests`, `(cd worker && npm ci && npm test && npm run typecheck)`, `(cd mcp-worker && npm ci && npm run check:repository)`; nếu `check:workflow-build` hoặc `check:knowledge-bundle` của `mcp-worker` báo lệch thì chạy `npm --prefix mcp-worker run generate:workflow-build` và commit đúng file sinh. Với G: `(cd community-worker && npm ci && npm test && npm run typecheck)`. Ghi thời gian `npm run build`, `npm run verify`, `npm run test:e2e` so với baseline của A vào `reports/baseline-output.md`.

## Test matrix tổng

| Hạng mục | Unit | Tích hợp | E2E / thủ công |
|---|---|---|---|
| N locale (A) | `i18n-locales`, `i18n-call-arity`, `compare-locale-output` | build + verify + `compare` = 0 | toàn bộ e2e cũ |
| Dữ liệu ja (B) | `test_shinjitai`, `test_build_lookup_ja` | `build_lookup_ja --check` | báo cáo độ phủ tên + soát dịch |
| Trang ja (C) | arity `vi,zh,ja`, mirror route, shinjitai parity, alias, gap report, hồ sơ ja | build + verify + `compare --allow-locale ja` | `ja-locale.spec.mjs`, `responsive`, design-compare |
| Worker (D) | schema/model/index/scan-modes, eval-score | parity locale | eval thật khi có khóa (không chặn) |
| Tier JP (E) | builder Python, facet JS | candidate + publish + public check | lọc `tierSource=jp` |
| Cộng đồng (G) | route + migration D1 giả | — | runbook release |
| Bài nháp (F) | — | — | soát độc lập |

## Docs (chỉ H sửa, tránh trùng sở hữu)

- `README.md`: tính năng `/ja/`, số trang build mới, lệnh `python3 -m pipeline.build_lookup_ja` và `node scripts/report-ja-gaps.mjs`, mục Cấu trúc thêm `src/pages/ja/`.
- `docs/code-standards.md`: mục "Bản tiếng Trung `/zh/`" đổi thành quy tắc chung theo `SITE_LOCALES` (thứ tự chỉ nối thêm, `pick` theo chỉ số, test arity, nhãn 機械翻訳); bảng payload thêm `#lookup-ja-pin`; sitemap/robots/hreflang ba locale.
- `docs/system-architecture.md`, `docs/codebase-summary.md`: luồng dữ liệu ja.
- `docs/unified-lookup.md`: trigger dựng lại `data/lookup-ja.json` sau mỗi lần promote Tra cứu, link `docs/ja-lookup-data.md`.
- `docs/season-team-data.md`: input `--jp-tiers`, quy tắc đối chiếu mùa theo tên kịch bản.
- `docs/deployment-guide.md`: runbook G (nếu có), lưu ý Pages `/ja/` phải lên sau migration/Worker cộng đồng.
- `docs/community-worker.md`: `lang = ja` (nếu G-A).
- `worker/README.md` do D sửa; `docs/ja-gaps.md`, `docs/ja-lookup-data.md` do C/B sinh.

## PR và review

1. Mở PR `feat/ja-locale` → `main`, mô tả: hợp đồng, phase, kết quả `compare` (đính kèm danh sách file dùng chung đổi + diff), số trang, thời gian build, báo cáo độ phủ tên/dịch, link GitHub issue cho việc hoãn. Kết thúc mô tả bằng dòng attribution theo system reminder.
2. Đề xuất review Astra → Fable cho phần `worker/`, `community-worker/`, generation Recommended, `pipeline/` (theo `AGENTS.md`); chạy thêm `code-reviewer` độc lập trên toàn diff (không đưa kết luận của người làm).
3. Tạo GitHub issue cho mọi việc "chưa làm có lý do": dịch máy ghi chú đội Đội chuẩn ở `/ja/` (nếu Q4 chọn ẩn), cách đọc kana, nâng độ phủ tên `verified`, eval AI thật khi có khóa, đội JP không có trong SGSDeck (Q3), G-B nếu chọn hạ cấp.
4. Không merge, không deploy (ngoài phạm vi).

## Rủi ro tổng hợp {#rủi-ro-tổng-hợp}

| # | Rủi ro | Khả năng × Tác động | Giảm thiểu | Phase |
|---:|---|---|---|---|
| 1 | Mỗi lần ghép phải ghim lại localization, dễ trộn generation | Cao × Trung bình | Chỉ H ghim; commit ghim của branch bị bỏ | A, C, D, E2 |
| 2 | Refactor lệch byte vi/zh | Trung bình × Cao | `compare` tự động + chuẩn hoá có test | A, C |
| 3 | D1 chặn `lang = ja` | Chắc chắn × Cao | Phase G hoặc G-B | G, C |
| 4 | Đối chiếu sai mùa JP↔VN | Trung bình × Cao | Khóa theo tên kịch bản, reviewer độc lập | E |
| 5 | Tên `derived` sai với tên chính thức Nhật | Cao × Trung bình | Nhãn trạng thái, tên gốc luôn hiện, override có nguồn | B, C |
| 6 | Dịch máy sai số/nghĩa | Trung bình × Cao | Kiểm số tự động, glossary, soát mẫu, nhãn 機械翻訳 | B |
| 7 | Sót chuỗi ja ở `.astro`/đường client hiếm | Trung bình × Trung bình | `pick` ném lỗi lúc build, arity tĩnh, e2e quét chữ Việt | C |
| 8 | Build/verify chậm thêm ~50% | Chắc chắn × Thấp | Đo, ghi; verifier đã chạy theo lô | C |
| 9 | `data/lookup-ja.json` cũ sau promote Tra cứu | Cao × Trung bình | Build dừng khi `lookupGenerationId`/`sources` lệch; trigger trong docs | B, C |
| 10 | Prompt Worker đổi chất lượng vi/zh | Thấp × Cao | Byte prompt vi/zh khóa bằng test | D |

## Rollback

Trước merge vào `main`: revert từng merge phase trên `feat/ja-locale` theo thứ tự ngược, sau mỗi revert chạy lại chuỗi ghim localization. Sau merge (ngoài phạm vi): rollback Pages theo `docs/deployment-guide.md` mục Rollback; Worker và D1 theo phase D/G.

## Câu hỏi chưa giải {#câu-hỏi-chưa-giải}

1. **Q1 — Phạm vi `community-worker`:** hợp đồng chỉ nêu `worker/`, nhưng trang cộng đồng `/ja/` và bài blog ja cần D1 nhận `lang = ja` (sáu bảng có `CHECK (lang in ('vi','zh'))`). Làm G-A (migration dựng lại bảng, rủi ro cao) hay G-B (ja chỉ đọc, ẩn khối ghi)?
2. **Q2 — Tier JP hiện ở đâu:** tier JP và facet nguồn JP có hiện trên cả `/doi-chuan/` vi và zh không (đề xuất: có, là thay đổi dữ liệu có chủ đích tách khỏi cổng trùng byte)? Facet là khóa mới `tierSource` (đề xuất) hay thêm giá trị vào facet `source` "Bộ đội hình" hiện có?
3. **Q3 — Đội JP không có trong SGSDeck:** chỉ báo cáo (đề xuất) hay thêm thành hàng Đội chuẩn mới?
4. **Q4 — Ghi chú đội chữ Trung trên `/ja/`:** ẩn + dòng báo thiếu (đề xuất, giữ phạm vi) hay dịch máy khoảng 2.700 khối ghi chú (mở rộng phạm vi)?
5. **Q5 — Nhãn số liệu:** hợp đồng ghi "theo bản Đại Lục", nhưng một phần chữ Trung nguồn là SGSDeck TW và một phần là chữ Hán dịch từ tiếng Việt (`effectZhSource.kind = "translation"`, `zhSource`). Giữ một câu "数値は中国大陸版に基づく" cho mọi mục, hay ghi theo nguồn từng mục?
6. **Q6 — Nguồn 2 ảnh chiến báo client Nhật:** chủ repo cung cấp, hay được phép cắt khung từ video/bài công khai của người chơi Nhật (đã che tên)?
7. **Q7 — Vendor bảng OpenCC (`JPVariants`, `TWVariants`, Apache-2.0)** vào `data/ja-kanji-variants.json` có được không, hay tự dựng từ bảng 旧字体/新字体 của 常用漢字表?
8. **Q8 — File dùng chung đổi khi thêm ja:** `404.html` (thêm khối ja), `robots.txt` (`Disallow: /ja/quan-tri/`), `_headers` (`/ja/*`), `_redirects` (luật `/ja/`) và `og:locale:alternate` có được tính là nằm trong "hreflang và nút ngôn ngữ thêm vào" không?
9. **Q9 — Dịch máy bằng model của chính sub-session** (máy chưa có khóa API) có được tính là "AI dịch" theo hợp đồng không, và có cần ghi tên model công khai trên trang không (đề xuất: chỉ ghi trong `pipeline/ja-translations.json`)?
10. **Q10 — Biến thể theo vị trí:** plan chọn `pick(locale, vi, zh, ja)` theo chỉ số `SITE_LOCALES` thay vì đổi 2.300 lời gọi sang dạng bản ghi `{vi, zh, ja}`. Chủ repo có chấp nhận cách này là "code đi theo danh sách SITE_LOCALES" không?
