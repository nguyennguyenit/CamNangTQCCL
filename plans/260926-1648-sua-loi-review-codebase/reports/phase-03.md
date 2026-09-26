# Phase 3 — UI/UX và lỗi logic giao diện (2026-09-27)

Chia ba phần chạy tuần tự (3a, 3b, 3c); mỗi phần tự chạy G0–G8 và gate A2 rồi commit.

## Part 3a — Đội chuẩn/Đội khác, Cùng Tồn, Tra cứu

Đường dẫn công cụ đã đổi (commit 158e919): `/soi-doi/` → `/soi-doi-tu-anh/`, `/goi-y-doi/` → `/goi-y-doi-tu-kho/`, `/chieu-mo/` → `/theo-doi-chieu-mo/`. Test và allowlist dùng đường dẫn mới.

### Test đỏ → xanh

E2E chạy trên `astro build` + `astro preview` (cổng 4174, config Playwright tạm ở `/tmp`, đã xoá). Unit dùng `node --experimental-strip-types --test <file>`, Python dùng `python3 -m unittest <module>`.

| Mục | Test | Đỏ trước sửa | Sau sửa |
|---|---|---|---|
| Chevron (AuditUiLive#3) | `recommended-browser.spec` "every chevron and filter icon on /doi-khac/ draws its own strokes" | ô `Mùa nguồn`: `Expected: 1` `Received: 0` (node polyline đã bị dời sang svg dựng sau) | xanh cả `/doi-chuan/` và `/doi-khac/` |
| `?season=all` (ReviewJsCore#5) | `recommended-browser.spec` "?season=all keeps every Đội chuẩn season…" | select `Expected: "all"` `Received: "og-兵演春秋"` | xanh: select = `all`, nhãn `Tất cả`, đếm `n / n đội` = số bản ghi index; chọn mùa → `season=<id>` |
| Slot nguồn trống (ReviewJsCore#13) | `recommended-browser.spec` "a source-empty third slot…" (thẻ + bảng), `team-detail-pages.spec` "a source-empty third seat…" | thẻ `…PHÓ 2Nội dung tiếng Việt chưa sẵn sàngBinh thư…`; chi tiết `Phó tướng 2Nội dung tiếng Việt chưa sẵn sàngChiến phápChưa có dữ liệu…`; sau khi sửa ô, bảng vẫn đỏ ở dòng đội hình `Tôn Thượng Hương · Lăng Thống · Nội dung tiếng Việt chưa sẵn sàng` | xanh: ô `—` có `role=img` và tên "Nguồn để trống" ở thẻ, bảng, chi tiết; dòng đội hình của bảng bỏ ô trống |
| Ngoặc toàn khổ (AuditUiLive#13) | `tests/test_recommended_identity.py` `test_team_titles_use_ascii_brackets_once_fully_translated` | `'Gian Hùng Kỵ（Lữ Bố）' != 'Gian Hùng Kỵ (Lữ Bố)'` | xanh; ký tự `（`/`）` trong `displayNameVi` không có chữ Hán: generation cũ 200 ký tự (100 tên), generation mới 0 |
| Title/description trùng (ReviewAstroCss#8) | `astro-dist-contract.test` "dist verifier admits exactly the catalog team pages…" (thêm ca) + `node scripts/verify-astro-dist.mjs` trên dist thật | unit: `Missing expected rejection. expected: /duplicate <title>…/`; dist thật: `Team detail pages share a duplicate <title>: Thục Trí Cung — Đội chuẩn — … (doi-chuan/pk-s4-thuc-tri-cung/…, doi-chuan/pk-s5-thuc-tri-cung/…)`. Đo trên dist cũ: 981 trang trong 257 nhóm cùng `<title>`, 45 trang cùng description | xanh: `Verified 1730 dist files` |
| Một bộ chọn kịch bản (ReviewJsCore#6) | `season-lookup.spec` "Cùng Tồn has exactly one scenario control…" | nút `Received ["OG · Binh Diễn Xuân Thu", "PK-S26 · Anh Hùng Mệnh Thế"]` (thứ tự phép chiếu, không theo registry; select "Tất cả — tham khảo" cùng hiện) | xanh: không có select, nút theo registry, nút được nhấn khớp tiêu đề nhóm và `?scenario=`, reload giữ, Back/Forward đúng |
| Focus khi đóng chi tiết (ReviewJsCore#9) | `season-lookup.spec` "closing a Cùng Tồn configuration returns focus…" (nút và Escape) | `toBeFocused` `Received: inactive` | xanh |
| Khoá quay lại (ReviewJsCore#10) | `team-detail-navigation.test` (sửa ca Cùng Tồn, thêm ca hai công cụ) | `actual: '/cung-ton/?group=coexist-bdx-group-0fb69f7aa19a&q=B%C3%ACnh'` | xanh |
| Nhóm/Back/focus (ReviewJsTools#8, #9, #10, AuditUiLive#9) | `unified-lookup.test` "thiếu group thì lưới vẫn là tất cả…" | `actual: 'heroes'`, `expected: null` | xanh |
| | `unified-lookup.spec` "mở thẻ từ chế độ tất cả giữ lưới tất cả…" | chip nhấn `Expected: 0` `Received: 1` | xanh |
| | "Xem thêm hai lần, mở thẻ thứ 150 rồi Back…" | `Expected: 180` `Received: 60` | xanh |
| | "đóng hồ sơ bằng nút X rồi một lần Back…" | `Expected: …/tra-cuu/` `Received: …/tra-cuu/?group=equipment` | xanh |
| | "Enter trên Xem thêm đưa focus tới thẻ đầu của lượt mới" | `toBeFocused` `Received: inactive` | xanh |
| Link số đội chuẩn (ReviewJsTools#7) | `unified-lookup.spec` "số đội chuẩn trong Trong cẩm nang là chữ…" | `.cam-nang-counts a` `Expected: 0` `Received: 1` | xanh |
| Trường hồ sơ (ReviewJsTools#24) | `unified-lookup.spec` "hồ sơ tướng hiện Điểm nội chính…" (`hero:luu-bi`, `civilInnatePoints = 0`, bản ghi duy nhất có trường này) | `Expected: 1` `Received: 0` | xanh |
| Nút đóng mobile (AuditUiLive#8) | `unified-lookup.spec` "nút đóng hồ sơ vẫn trong màn hình…" (375px, cuộn 1500px) | `Expected: >= 0` `Received: -1414` | xanh |
| Chế độ xem Thẻ/Thẻ gọn/Bảng (AuditUiLive#12, Q7 = A) | Chỉ đổi chữ, không có test đỏ. Tiêu đề test `recommended-browser.spec` và comment `team-view.test.mjs:1` đổi theo nhãn mới; assertion hành vi giữ nguyên | — | xanh |

### Quyết định khi làm
- **Chip "Tất cả" của Tra cứu:** chọn phương án bấm lại chip đang nhấn để về tất cả, nên không thêm chữ mới. Bước lịch sử của hồ sơ lưu ở `history.state.lookupDialogDepth`. Đóng hồ sơ mở bằng push sẽ gọi `history.go(-depth)`; hồ sơ mở bằng deep link đóng bằng `replaceState`. Kiểm hợp lệ `id-kind-mismatch` giữ nguyên. Nút quan hệ trong hồ sơ vẫn đặt `group` theo nhóm đích như trước.
- **Cùng Tồn:** bấm nút kịch bản gọi `resolveBrowseState(…, {origin:'scenario-change'})` như select cũ, nên kịch bản có đúng một luật đã review vẫn tự chọn luật đó. Plan ghi `ruleset: null`; trên dữ liệu thật kết quả như nhau vì chưa kịch bản nào có luật. Nếu URL thiếu `scenario` mà `group` trỏ tới nhóm của kịch bản khác, trang chọn kịch bản của nhóm đó, để link cũ đã chia sẻ vẫn mở đúng nhóm. Bỏ CSS chết `.coexist-head .reference-scope-controls`.
- **Nút đóng mobile:** dùng `position: fixed` (tính bằng token), không dùng `sticky`. Lý do: nút nằm trong `.lookup-dialog-head`, khối chứa của nó cuộn đi cùng đầu hồ sơ, nên `sticky` không giữ được nút trong màn hình.
- **Tiêu đề trùng:**
  - Helper `detailTitleRanks` trong `src/lib/team-detail-routes.ts` xếp số thứ tự theo `routeSegment`.
  - Đội chuẩn: `${tên} (${mã mùa}[ · n])`. Description thêm `(n)` khi cần.
  - Đội khác trùng tên: thêm nhãn nguồn `SOURCE_LABEL`, còn trùng thì thêm ` · n`.
  - Giữ nguyên cụm `— Đội chuẩn —` và `— Đội khác —` của tuple `translate`.

### G0: tuple của file sửa
| File | Số tuple | Ghi chú |
|---|---|---|
| `js/team-filter-section.js` | 31 (3 `translate`) | 3 tuple `translate` không đụng |
| `js/recommended-reference-render.js` | 27 | 0 `translate` |
| `js/app.js` | 3 `translate` | giữ nguyên `title:'Team chuẩn'`/`'Team khác'` và `displayValue(...)` |
| `js/unified-lookup.js` | 53 | 0 `translate`; giữ nguyên expression `["Vai trò", valueText(fieldByKey(profile, "roleTagViet"), "")]` |
| `js/lookup-detail.js` | 4 | 0 `translate`; file không sửa, chỉ thêm tuple |
| `src/pages/doi-chuan/[team].astro` | 7 (5 `translate`) | giữ nguyên |
| `src/pages/doi-khac/[team].astro` | 4 `translate` | giữ nguyên |
| `js/team-detail-navigation.js`, `src/lib/team-detail-routes.ts`, `css/styles.css`, `pipeline/recommended_identity.py`, `scripts/verify-astro-dist.mjs` | 0 | — |

### G1: tuple
- **Đổi chữ** 4 tuple `authored-vi`:
  - `ui:recommended/view-cards`: `label:'Thẻ'`
  - `ui:recommended/view-grid`: `label:'Thẻ gọn'`
  - `ui:recommended/view-cards-aria`: `'Xem dạng thẻ'`
  - `ui:recommended/view-grid-aria`: `'Xem dạng thẻ gọn'`
  - `view-table` và `view-table-aria` giữ nguyên.
- **Thêm** 4 tuple `authored-vi`:
  - `ui:recommended/source-empty-seat` (`'Nguồn để trống'`, `sourceEmptySeat`)
  - `ui:lookup/hero-civil-points` (`"Điểm nội chính"`), `ui:lookup/hero-collectible-bonus` (`"Thưởng sưu tầm"`), `ui:lookup/hero-red-rules` (`"Quy tắc điểm đỏ"`); cả ba ở `js/lookup-detail.js::heroProfile`
- **Không** thêm, đổi hay bỏ tuple `translate` nào.

### Mốc
- `policyVersion`: `site-vi-260927-loi-nang` → `site-vi-260927-ui-ux-a`.
- `baseline.notes`:
  - `concreteLocationCount` 56661 → 56665
  - `concreteInventorySha256` `fc6da1ed…` → `abe264a4…`
  - `siteLedgerObligations` 2088, `translationObligations` 5591, `uiTranslateObligations` 68 (không đổi)
- **Generation mới:** `17a9c663012c5feac4a1085f8faf248629234d242f0ab6af6a59137cf4baaabd`.
  - G6: `git rm` generation `07792857…` do Phase 2 phần G tạo.
  - Generation `8ebaf2fa…` sinh ở lượt publish đầu của phần này, bị thay khi sửa lỗi kiểu `astro check`; đã xoá, chưa từng commit.
  - `pipeline/team-route-handles.json` đã re-pin; `--check` pass.
- **`WORKFLOW_BUILD_ID`:** không đổi (`build:sha256b64:qHn02bMBS3j-EM1Snk1N6QLK9yLx-m8NrwSGD6gy0-I`), vì không file nào thuộc bao đóng MCP bị sửa.
- **Số ghim `tests/test_site_localization.py`:** không đổi.

### Docs
- `docs/code-standards.md`: khoá query Cùng Tồn/công cụ.
- `docs/design-guidelines.md`: nhãn chế độ xem, bộ chọn kịch bản Cùng Tồn.
- `README.md`: nhãn chế độ xem, phạm vi.
- `docs/deployment-guide.md:269`.
- `docs/design/so-binh-phap/tokens.json`: component `chuyen-the-bang` và biến thể thẻ.
- `docs/project-changelog.md`: thêm mục mới.

### Sửa test hiện có theo hành vi mới (có chủ đích)
- `season-lookup.spec`: các ca trước đây dùng select `#season-scenario` trên `/cung-ton/` nay dùng hàng nút kịch bản. Gồm: real scenario-only, stale filter query, season details theo bề rộng (focus nút `Đóng chi tiết`, kiểm ≥ 44px), Binh Diễn screenshot, coexist rows/URL/reload, keyboard focus.
- `season-lookup.spec`: bỏ ca "scenario history re-renders… Back and Forward" vì đã được ca mới "Cùng Tồn has exactly one scenario control…" (có Back/Forward) thay thế.
- `spa-parity.spec` "Back/Forward cùng tài liệu đóng menu mobile…": chọn kịch bản bằng nút thay cho select.
- `unified-lookup.test`: ca "thiếu group thì suy ra từ loại ID" đổi thành "lưới vẫn là tất cả".
- `team-detail-navigation.test`: ca Cùng Tồn giữ `q` đổi theo allowlist mới.

### Gate A2 (exit 0, 183 s)
| Bộ | Kết quả |
|---|---|
| `npm run verify` | `Verified 1730 dist files` |
| `npm run test:dist` | 28/28 |
| `npm run test:node` | 362/362 |
| `npm run test:e2e` | 300 passed |
| `python3 -m unittest discover -s tests` | 383 OK |
| `team_route_handles --check` | pass |
| `worker` vitest | 6 file, 53 test |
| `mcp-worker` check | 43 file, 374 test |
