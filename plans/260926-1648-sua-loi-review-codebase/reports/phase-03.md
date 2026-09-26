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

## Part 3b — Công cụ, Chiêu mộ

### Test đỏ → xanh

E2E chạy trên `astro build` + `astro preview` (cổng 4174, config Playwright tạm ở `/tmp`, đã xoá). Unit dùng `node --experimental-strip-types --test <file>`, MCP dùng `npx vitest run <file>` trong `mcp-worker/`.

| Mục | Test | Đỏ trước sửa | Sau sửa |
|---|---|---|---|
| Kho rỗng (AuditUiLive#2) | `beta-tools.spec` "kho rỗng: nút Xác nhận khoá, bước Kiểm tra và Gợi ý còn chờ" | `toBeDisabled` `Received: enabled` (nút "Xác nhận dữ liệu đã đọc") | xanh; bước `review`/`suggest` = `pending` |
| | "Nên thêm: đủ 5 đội khóa và không đội nào thêm được là hai câu khác nhau" | `Expected: "Đã đủ 5 đội."` `Received: "Đã đủ 5 đội hoặc chưa có đội phù hợp."` | xanh; kho không xây được đội báo "Chưa có đội phù hợp để thêm từ kho hiện tại." |
| Turnstile `error-callback` (AuditUiLive#6) | `beta-tools.spec` "Turnstile báo lỗi › Soi đội…", "…› Gợi ý đội…" (stub cấp token rồi gọi `error-callback("110200")`, ném nếu thiếu callback hoặc callback không trả `true`) | `pageErrors` `Received: ["[Cloudflare Turnstile] Error: 110200."]` ở cả hai trang | xanh: không `pageerror`, dòng trạng thái báo câu tiếng Việt, Soi đội giữ nút khoá sau khi chọn ảnh, Gợi ý đội báo "Xác thực Turnstile trước." và không gọi Worker |
| Ô chọn file (AuditUiLive#7) | `beta-tools.spec` "ô chọn ảnh: không lộ input file hệ thống…" | `input[type="file"]:visible` `Expected: 0` `Received: 3` | xanh: mỗi thẻ có nút "Chọn ảnh" mở `filechooser`, tên tệp hiện trong thẻ; `setInputFiles` trên input ẩn vẫn chạy (các ca cũ xanh) |
| Độ tin cậy OCR (ReviewJsTools#15) | `beta-tools.spec` "tên đọc từ ảnh không khớp từ điển có dấu kiểm tra và nằm đầu danh sách" | chip có "kiểm tra" `Expected: 1` `Received: 0` | xanh: chip `confidence: "low"` có chữ "kiểm tra" nhìn thấy và đứng đầu; `Tuân Úc` (medium), `Lưu Bị`, `Tào Tháo` không có dấu |
| Nhiều hột (ReviewJsTools#14, Q2 = A) | `team-recommend-engine.test` "Nhiều hột xếp số hột trước bậc; Meta vẫn xếp bậc trước" (greedy và full-box) | `redStars` `actual: ['a-t0-no-red']` `expected: ['b-t1-red']`; ca `meta` xanh cả trước và sau | xanh |
| | "full-box Nhiều hột chọn danh sách tổng hột cao hơn khi cùng số đội" (A+B tổng 5 hột, C+D tổng 6, A một mình nhiều hột nhất) | `actual: ['a','b']` `expected: ['c','d']`; `meta` giữ `['a','b']` | xanh |
| `sure`/`total` (ReviewJsTools#16) | `analyze-map.test` "tướng đoán từ chân dung không tính là khớp nhưng vẫn vào mẫu số" | `heroHit` `actual: 3` `expected: 2` | xanh: `heroHit = 2`, `total = 3` |
| | MCP `test/domain/legacy-domain-adapter.test.ts` "counts a portrait-guessed hero in the total but not as a similar-team hit" | `"heroHit": 3` (mong `2`) | xanh |
| "bên phải" (ReviewJsTools#17) | Chỉ đổi chữ, không test đỏ | — | — |
| Nhãn slot, mẫu số (ReviewJsTools#11) | `recruit-tracker-ui.test` "history rows name the daily slot in Vietnamese and count pulls against each banner's own pity limit" | `slotText` `actual: undefined` `expected: 'Miễn phí 1'` (view model chưa có nhãn; DOM ghép thẳng `drawSlot` và `/30`) | xanh: `lượt 1/30` cho lượt ngày, `lượt 12/40` cho gói `pityLimit = 40` |
| | `beta-tools.spec` "form 5★ nhận focus…" (sửa kỳ vọng cũ ghim `free_1`) | `Expected: "Ghi 5★ · Miễn phí 1"` `Received: "Ghi 5★ · free_1"` | xanh |
| 5★ trên slot đã xong (ReviewJsTools#12) | `recruit-tracker-store.test` "5★ on a daily slot that is already done records nothing…" | `actual: 2` `expected: 1` (thêm sự kiện 5★ trùng lên ô `miss`) | xanh |
| | `beta-tools.spec` "5★ lượt ngày ghi vào đúng ô đã mở: form không có ô ngày…" | đỏ ở tiêu đề `Received: "Ghi 5★ · free_1"` (form còn ô `Ngày`) | xanh: không có ô ngày, lịch sử `<hôm nay> · Danh tướng PK · Miễn phí 1`, `lượt 2/30` |
| Qua nửa đêm (ReviewJsTools#13) | `beta-tools.spec` "qua nửa đêm khi trang còn mở…" (`page.clock` 23:59, ghi đủ 4 ô, chạy đồng hồ 2 phút) | `.rt-slot-status` `Received: ["Không ra" ×4]` (mong "Chưa quay") | xanh: 4 ô "Chưa quay", nút bấm được, "Hôm nay 0/4" |

### Quyết định khi làm
- **`total` của đội tương tự:** mẫu số là số tướng nhận diện được (khớp từ điển, kể cả không chắc); tướng không khớp từ điển vẫn ngoài mẫu số như ca `[M1]` có sẵn. Tướng chỉ được tính khớp khi `sure !== false`: bản ghi canonical của MCP `tqccl_match_team` không mang cờ `sure` nên vẫn coi là chắc chắn (lượt đầu dùng `sure === true` làm đỏ 2 test MCP `research-handlers.test.ts`; đã sửa theo cách này, test MCP không phải đổi).
- **Nhiều hột:** `compareCandidates(a, b, mode)` so `redCopyScore` trước bậc khi `mode === "redStars"`; `portfolioIsBetter` (full-box) so số đội trước, rồi tổng hột của các đội không khoá, rồi thứ tự cũ. Không test MCP nào ghim danh sách `redStars` cũ.
- **Turnstile:** `renderTurnstileWidget(box, {onToken, onExpire, onError})` ở `js/analyze.js`; `error-callback` gọi `onExpire` (bỏ token), `onError(câu báo)` và trả `true`. Gợi ý đội thêm dòng `p.ana-status` trong hàng điều khiển; token mới thì ẩn dòng này. Soi đội ghi vào dòng trạng thái có sẵn (chọn ảnh sau đó thay dòng này như mọi trạng thái khác, nút vẫn khoá).
- **Ô chọn file:** input dùng class `.ana-file` (ẩn), nút "Chọn ảnh" (`aria-describedby` = tiêu đề thẻ) gọi `fileInput.click()`, tên tệp ở `.ana-file-name`. Bỏ luật CSS 44px cho input native (`css/styles.css`, khối mobile) vì input không còn hiện.
- **Chiêu mộ:** `dailySlotLabel` export từ `js/recruit-tracker-store.js` (giá trị lạ, gồm bản ghi cũ đã lưu nhãn, giữ nguyên); `getFiveStarHistory` thêm `pityLimit` của gói. Form 5★ lượt ngày lấy ngày của lưới lúc mở form. Vẽ lại khi đổi ngày: hẹn giờ tới nửa đêm địa phương kế tiếp và kiểm lại ở `visibilitychange`/`focus`.

### G0: tuple của file sửa
| File | Số tuple (trước) | Ghi chú |
|---|---|---|
| `js/roster-recommend-ui.js` | 46 (10 `translate`) | 10 tuple `translate` không đụng (gồm 2 binding) |
| `js/analyze.js` | 28 (4 `translate`) | giữ nguyên binding `localizeWorkerError(data?.error, res.status)`, `describeAnalyzeError(e, ANALYZE_ACTION_ERROR)` |
| `js/recruit-tracker.js` | 44 (21 `translate`) | `translate` không đụng |
| `js/recruit-tracker-store.js` | 6 (6 `translate`) | không đụng |
| `js/analyze-map.js`, `js/team-recommend-engine.js`, `css/styles.css` | 0 | `analyze-map.js`, `team-recommend-engine.js` thuộc bao đóng MCP |

### G1: tuple
- **Đổi chữ** 2 tuple `authored-vi`:
  - `ui:analyze/step-done`: `Đã đọc xong — kiểm tra lại kết quả đã đọc`
  - `ui:roster/add-empty`: `Chưa có đội phù hợp để thêm từ kho hiện tại.`
- **Thêm** 4 tuple `authored-vi`:
  - `ui:roster/add-full` (`Đã đủ 5 đội.`, `renderRecommendation`)
  - `ui:roster/scan-pick-action` (`"Chọn ảnh")`, `initRosterRecommend`; có dấu ngoặc vì `Chọn ảnh` là chuỗi con của `Chọn ảnh trước.`)
  - `ui:roster/flag-check` (`"kiểm tra")`, `itemList`)
  - `ui:analyze/turnstile-error` (`Xác thực chống bot không thành công. Tải lại trang rồi thử lại.`, `renderTurnstileWidget`)
- **Không** thêm, đổi hay bỏ tuple `translate` nào.

### Mốc
- `policyVersion`: `site-vi-260927-ui-ux-a` → `site-vi-260927-ui-ux-b`.
- `baseline.notes`:
  - `concreteLocationCount` 56665 → 56669
  - `concreteInventorySha256` `abe264a4…` → `1473c276…`
  - `siteLedgerObligations` 2088, `translationObligations` 5591, `uiTranslateObligations` 68 (không đổi)
- **Generation mới:** `f1fcb066ab7f941c797386814342cd9a330c001c2b018392397abe0b628569c4`.
  - G6: `git rm` generation `17a9c663…` do phần 3a tạo.
  - Generation `a7a46727…` sinh ở lượt publish đầu của phần này, bị thay khi sửa bộ lọc `sure` cho MCP; đã xoá, chưa từng commit.
  - `pipeline/team-route-handles.json` đã re-pin; `--check` pass.
- **`WORKFLOW_BUILD_ID`:** `build:sha256b64:qHn02bMBS3j-EM1Snk1N6QLK9yLx-m8NrwSGD6gy0-I` → `build:sha256b64:16lthgms6OS6yKbBUjEd-ca3F-XW76my0UXhZLYDCNE` (`js/analyze-map.js`, `js/team-recommend-engine.js` thuộc bao đóng).
- **Số ghim `tests/test_site_localization.py`:** không đổi.

### Docs
- `docs/project-changelog.md`: thêm mục phần 3b.

### Sửa test hiện có theo hành vi mới (có chủ đích)
- `beta-tools.spec` "form 5★ nhận focus…": kỳ vọng tiêu đề `Ghi 5★ · free_1` (ghim lỗi) đổi thành `Ghi 5★ · Miễn phí 1`.
- `season-lookup.spec` "tool pages drop old season links and run on the legacy teams": ca này bấm "Xác nhận" trên kho rỗng (chính lỗi AuditUiLive#2) nên đỏ sau khi sửa (`element is not enabled`); nay gieo tướng/chiến pháp của một đội legacy trước khi mở `/goi-y-doi-tu-kho/`, kiểm hành vi giữ nguyên (URL bỏ khoá mùa, gợi ý chạy trên đội legacy).

### Gate A2 (exit 0, 188 s)
| Bộ | Kết quả |
|---|---|
| `npm run verify` | `Verified 1730 dist files` |
| `npm run test:dist` | 28/28 |
| `npm run test:node` | 367/367 |
| `npm run test:e2e` | 308 passed |
| `python3 -m unittest discover -s tests` | 383 OK |
| `team_route_handles --check` | pass |
| `worker` vitest | 6 file, 53 test |
| `mcp-worker` check | 43 file, 375 test |

## Part 3c — Trang chi tiết, Shell

### Test đỏ → xanh

E2E chạy trên `astro build` + `astro preview` (cổng 4174, config Playwright tạm ở gốc repo vì `/tmp` không resolve được `@playwright/test`; đã xoá). Unit dùng `node --experimental-strip-types --test <file>`.

| Mục | Test | Đỏ trước sửa | Sau sửa |
|---|---|---|---|
| Phân loại lỗi (ReviewJsCore#8) | `detail-actions.test` "fetch bị chặn hoặc HTTP lỗi là lỗi mạng", "dữ liệu đổi, sai hoặc thiếu là lỗi xác minh…" | `SyntaxError: The requested module '../js/detail-actions.js' does not provide an export named 'isNetworkError'` (hàm còn là bản riêng trong `khaihoang-detail.js`) | xanh |
| | `team-detail-pages.spec` "a changed teams.json reads as a verification failure and an unreachable one as a network failure" (route trả `teams.json` thêm `\n`, rồi abort) | `Expected substring: "Không thể xác minh dữ liệu đội hình"` `Received: "Không tải được chi tiết đội hình. Hãy kiểm tra kết nối rồi thử lại.Thử lại"` | xanh: byte lệch → thông điệp xác minh; abort → "Hãy kiểm tra kết nối" |
| Copy link (ReviewJsCore#14) | `team-detail-pages.spec` "copy link reports the real clipboard result…" (sửa kỳ vọng cũ ghim URL có `from`) | `Expected: ".../doi-chuan/pk-s24-tiem-long-dieu-thuyen/"` `Received: "...?from=%2Fdoi-chuan%2F%3Fseason%3Dpk-s24"` | xanh; ô dự phòng khi clipboard lỗi cũng là URL không `from` |
| | "copy link on a Khai hoang detail keeps the chosen variant and drops from" | `Expected: ".../gia-cat-khac-sp-ma-sieu-phap-chinh/?variant=cn-thoi-phong"` `Received: "...?from=%2Fkhai-hoang%2F%3Fq%3Dx&variant=cn-thoi-phong"` | xanh |
| Khoảng trống đầu Khai hoang (AuditUiLive#10) | "Khai hoang detail with a tall source panel keeps the title right under the back link" (1280px, đo `h1.top − #team-return-link.bottom` trên trang Đội chuẩn `index.records[0]` rồi `/khai-hoang/chu-thai-truong-phi-truong-xuan-hoa/`, panel 4 link nguồn) | `Expected: <= 158.39` `Received: 166.41` | xanh |
| Khung chỉ có nút copy (AuditUiLive#11) | "Đội khác detail drops the score panel content…" (kiểm `#team-detail-panel` thay `.detail-score-panel`, thêm viền) | `borderTopStyle` `Expected: "none"` `Received: "solid"` | xanh |
| Tagline (AuditUiLive#4, ReviewAstroCss#5, Q1 = A) | `spa-parity.spec` "tagline trang mục là mô tả của chính mục trong menu; Landing không có tagline" (bảng 8 dòng, dòng menu `aria-current` cùng chữ, Landing 0 `.tagline`, chi tiết Đội chuẩn "Chi tiết đội chuẩn", 404 "Không tìm thấy trang") | `/doi-chuan/` `Expected: "Cấu hình đội theo mùa nguồn"` `Received: "Duyệt đội hình theo mùa nguồn"` | xanh |
| | "320px: tagline một dòng…" viết lại: 8 trang, một dòng, không tràn header, `overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap`; bỏ ghim `clipped: true` và ca 1024px "hiện trọn chữ" | — (viết lại, không có đỏ riêng) | xanh |
| Mục hiện tại trong nav (AuditUiLive#5) | "mục đang xem nổi bật: dòng menu mobile có aria-current và nút Công cụ trên trang công cụ" | style dòng `Đội khác` = `Đội chuẩn`: `Expected: not "0px\|rgb(243, 238, 227)\|rgba(0, 0, 0, 0)\|rgb(243, 238, 227)\|600"` | xanh: dòng hiện tại có vạch trái và nhãn son; ở 3 trang công cụ nút `Công cụ` khác `Game`, ở `/doi-chuan/` giống `Game` |
| Tương phản tối (ReviewAstroCss#6) | `selected-state-contrast.spec` "link "website chính thức" ở #tai-game khi hover vẫn đọc được ở cả hai theme" | `dark: chữ link khi hover` `Expected: >= 4.5` `Received: 1.7726659849954718` | xanh ở cả hai theme; `design-tokens.mjs --check` ok |
| Nút theme (ReviewAstroCss#11) | `spa-parity.spec` "nút giao diện giữ tên 'Giao diện tối'…" | `toHaveAccessibleName` `Expected: "Giao diện tối"` `Received: "Chuyển sang giao diện tối"` | xanh: tên không đổi, `aria-pressed` false → true ở cả hai nút |
| h1/noscript (ReviewAstroCss#12) | "không có JavaScript: 8 trang mục vẫn có h1 tên mục…" (context `javaScriptEnabled: false`, rồi trang bật JS) | `/doi-chuan/` `h1` `Expected: 1` `Received: 0` | xanh: không JS có `h1` tên mục + lời nhắn; có JS đúng 1 `h1` |
| `aria-label` trên `div` (ReviewAstroCss#13) | "khối phạm vi mùa là nhóm có tên 'Phạm vi đội hình'" (`/doi-chuan/`, `/cung-ton/`; `includeHidden` vì JS ẩn khối này sau khi dựng) | `/doi-chuan/` `Expected: 1` `Received: 0` | xanh |
| Mô tả Cùng Tồn (ReviewAstroCss#14, phần trang) | Chỉ đổi chữ, không test đỏ | — | — |
| Preload font Việt (ReviewAstroCss#19) | Không test đỏ; `dist/doi-chuan/index.html` có 4 preload (`be-vietnam-pro-400-{latin,vietnamese}`, `noto-serif-display-700-{latin,vietnamese}`), `npm run verify` xanh | — | — |
| Thẻ `og:` (ReviewAstroCss#21) | `astro-dist-contract.test` "every canonical page declares site name, Vietnamese locale and an absolute og:image shipped in dist" (1558 trang trong sitemap) | `actual: null` `expected: 'Cẩm Nang Tam Quốc Chí'` | xanh |
| | `pages-headers-contract.test` (thêm `/og-image.png` vào bảng luật và đường dẫn công khai) | `deepEqual` thiếu `'/og-image.png'`; `policyFor('/og-image.png')` `actual: undefined` | xanh |

### Quyết định khi làm
- **Phân loại lỗi:** `isNetworkError` (regex cũ của Khai hoang: `Failed to fetch|NetworkError|load failed|: \d{3}$`) export từ `js/detail-actions.js`; `team-detail.js` chỉ báo lỗi mạng khi hàm này đúng, mọi lỗi khác là lỗi xác minh. Khai hoang giữ ba thông điệp xác minh riêng như cũ.
- **Copy link:** URL chia sẻ = URL đang xem bỏ `from`; giữ mọi tham số khác (`variant` của Khai hoang và biến thể Đội khác).
- **Khung chỉ có nút copy:** sửa bằng CSS `.detail-score-panel:not(:has(.detail-score, .detail-source-link))` (không khung, không đệm), không sửa `src/pages/doi-khac/[team].astro`. Lý do: Đội khác luôn chỉ có nút copy, còn Khai hoang cũng rơi vào đúng trường hợp này khi cấu hình đang chọn không có nguồn; một luật theo nội dung phủ cả hai. 4 tuple `translate` của `doi-khac/[team].astro` không bị chạm.
- **Nút Công cụ:** chỉ thêm class `active` (cùng kiểu tab nav đang ở mục), không đặt `aria-current` lên nút mở menu; link công cụ trong menu vẫn mang `aria-current="page"`.
- **noscript:** layout phát `<noscript><h1 class="reference-title">{nhãn SECTIONS}</h1><p class="scope-note">…</p></noscript>` cho `pageKind="section"`; khi JS bật, trình duyệt không dựng nội dung `noscript` nên vẫn chỉ có `h1` do JS vẽ.
- **og:image:** thêm `og:image:width`/`og:image:height` (1200×630). Ảnh sinh bằng Chromium của Playwright, lệnh ghi ở `docs/design/so-binh-phap/README.md` (mục "Ảnh chia sẻ `og:image`"). Fixture của `astro-dist-contract.test` dùng helper `writeStaticImages` (favicon + og-image) thay 5 khối chép favicon.

### G0: tuple của file sửa
| File | Số tuple (trước) | Ghi chú |
|---|---|---|
| `src/layouts/SiteLayout.astro` | 42 (4 `translate`) | `label: 'Team chuẩn'`, `label: 'Team khác'`, `>Beta<`, `Build bởi` không đụng; 8 mô tả `SECTION_DESCRIPTIONS` giữ nguyên chữ |
| `js/detail-actions.js` | 5 | 0 `translate` |
| `src/pages/cung-ton/index.astro` | 2 | 0 `translate`; metaDescription là `authored-vi` nên được đổi chữ |
| 7 `src/pages/*/index.astro` còn lại | 2 mỗi file | 0 `translate`; chỉ bỏ prop `tagline` |
| `js/site-chrome.js`, `js/team-detail.js`, `js/khaihoang-detail.js`, `css/styles.css`, `scripts/verify-astro-dist.mjs` | 0 | — |
| `src/pages/doi-khac/[team].astro` | 4 `translate` | không sửa file |

### G1: tuple
- **Đổi chữ** 1 tuple `authored-vi`: `ui:section-page/cung-ton` metaDescription → `Các nhóm tướng Cùng Tồn theo kịch bản, kèm cấu hình áp dụng và phần tham khảo.`
- **Thêm** 2 tuple `authored-vi` ở `src/layouts/SiteLayout.astro`:
  - `ui:layout/theme-toggle` (`Giao diện tối`, `header`)
  - `ui:layout/section-noscript` (`Mục này cần JavaScript để hiển thị nội dung. Hãy bật JavaScript rồi tải lại trang.`, `noscript`, trạng thái `no-js`)
- Bỏ 8 prop `tagline` và mặc định `'Tất cả — tham khảo'` không đổi inventory ngoài hash file (G2 xác nhận: số location +2 đúng bằng 2 tuple mới).
- **Không** thêm, đổi hay bỏ tuple `translate` nào.

### Mốc
- `policyVersion`: `site-vi-260927-ui-ux-b` → `site-vi-260927-ui-ux-c`.
- `baseline.notes`:
  - `concreteLocationCount` 56669 → 56671
  - `concreteInventorySha256` `1473c276…` → `6ba7478a…`
  - `siteLedgerObligations` 2088, `translationObligations` 5591, `uiTranslateObligations` 68 (không đổi)
- **Generation mới:** `b3636badcbbbea55adade7b9c6ed2a0640801c779e9a4aa3e44dfc71d5bbdcd9`.
  - G6: `git rm` generation `f1fcb066…` do phần 3b tạo.
  - `pipeline/team-route-handles.json` đã re-pin; `--check` pass.
- **`WORKFLOW_BUILD_ID`:** không đổi (`build:sha256b64:16lthgms6OS6yKbBUjEd-ca3F-XW76my0UXhZLYDCNE`), không file nào thuộc bao đóng MCP bị sửa.
- **Số ghim `tests/test_site_localization.py`:** không đổi.

### Docs
- `docs/code-standards.md`: `public/og-image.png` trong nhóm file tĩnh verifier so byte, `_headers` 17 luật (thêm `/og-image.png`), thẻ `og:site_name`/`og:locale`/`og:image`.
- `docs/design/so-binh-phap/README.md`: preload 4 file font; mục "Ảnh chia sẻ `og:image`" kèm lệnh sinh.
- `docs/design-guidelines.md`: tên cố định của nút đổi giao diện.
- `docs/project-changelog.md`: thêm mục phần 3c.

### Sửa test hiện có theo hành vi mới (có chủ đích)
- `team-detail-pages.spec` "copy link reports the real clipboard result…": kỳ vọng cũ ghim URL gồm `from` (chính lỗi ReviewJsCore#14) đổi thành URL không `from`, cả clipboard lẫn ô dự phòng.
- `team-detail-pages.spec` "Đội khác detail drops the score panel content…": kiểm `#team-detail-panel` (panel không còn là ô có khung) và thêm kiểm không viền.
- `spa-parity.spec` "320px: tagline…": viết lại theo Q1 = A (xem bảng trên).

### Gate A2
Exit 0, 194 s.

| Bộ | Kết quả |
|---|---|
| `npm run verify` | `Verified 1731 dist files (58 raw assets, 16 static public files)` |
| `npm run test:dist` | 29/29 |
| `npm run test:node` | 370/370 |
| `npm run test:e2e` | 317 passed |
| `python3 -m unittest discover -s tests` | 383 OK |
| `team_route_handles --check` | pass (generation `b3636bad…`) |
| `worker` vitest | 6 file, 53 test |
| `mcp-worker` check | 43 file, 375 test |

## Tóm tắt Phase 3

- 3 phần (3a `e91b9b3`, 3b `6107e66`, 3c) phủ toàn bộ finding của Phase 3: Đội chuẩn/Đội khác, Cùng Tồn, Tra cứu (3a); Công cụ, Chiêu mộ (3b); Trang chi tiết, Shell (3c). Không mục nào bị chặn; không tuple `translate` nào bị đổi.
- Quyết định Q1 (tagline = mô tả mục), Q2 (Nhiều hột xếp hột trước bậc), Q7 (Thẻ / Thẻ gọn / Bảng) đã áp dụng.
- `policyVersion` cuối `site-vi-260927-ui-ux-c`, generation đang pin `b3636bad…`; generation trung gian của 3a, 3b đã xoá. `WORKFLOW_BUILD_ID` đổi một lần ở 3b.
