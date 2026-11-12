# Code review: nhánh `feat/doi-chuan-badge-kho` (#59, #62)

Ngày: 2026-11-11 · Người review: code-reviewer (độc lập, chỉ đọc) · Phạm vi: `git diff origin/main...HEAD` (4 commit, 16 file, +825/−24)

## Kết luận nhanh

- Có **1 lỗi đúng/sai đã tái hiện bằng script**: danh sách bỏ qua `tacticOverrides` (món bù), nên số "Ráp được" và "Thiếu N món" lệch với khối Độ phủ kho của Gợi ý đội. Lỗi này trái với tiêu chí thành công #1 của `plan.md`, dù phase 3 có ghi "không áp `tacticOverrides`". Hai chỗ trong plan mâu thuẫn nhau, nên anh cần chốt hướng. Tôi xếp là **chặn merge nếu giữ tiêu chí #1**.
- Có **1 lỗi race đọc ra từ code, chưa chạy e2e**: quay lại từ trang chi tiết khi URL có `kho`/`xep` thì mất thẻ đích, focus và các thẻ đang mở. Mức: nên sửa.
- Các lỗi còn lại ở mức nên sửa hoặc gợi ý.
- Không thấy rò kho giữa hai tài khoản đăng nhập trong luồng bình thường. Còn một kẽ hở qua bfcache, đọc ra từ code (F4).
- Đã chạy: `npm run test:node` đạt 850/850. `node --check` qua 8 file JS đã sửa. Ba file test node mới/đã sửa đạt 42/42. **Không chạy e2e** vì bộ e2e cần bản dựng `dist` mà hook chặn.

Ký hiệu nguồn: **[chạy]** = đã kiểm bằng lệnh hoặc script; **[đọc]** = suy ra từ đọc code, chưa chạy.

---

## Chặn merge (phụ thuộc quyết định của anh)

### F1. Danh sách không áp món bù (`tacticOverrides`), lệch với khối Độ phủ kho [chạy]

- `js/roster-list-coverage.js:61-68`: gọi `buildRosterCoverage` trên `season.teams` thô, không qua `applyTacticOverrides`.
- `js/roster-list-coverage.js:44,49`: `readOwnedRoster` chỉ trả `ownedHeroes` và `ownedTactics`. `tacticOverrides` có cả trong kho local lẫn trong `toScanState` của cloud nhưng bị bỏ.
- Bên Gợi ý đội, `js/roster-recommend-ui.js:1318` tính `seasonTeams: applyTacticOverrides(season.teams, state.tacticOverrides)`.
- Lời ghi ở `js/roster-list-coverage.js:2-3` ("hai nơi luôn ra cùng con số cho cùng kho") vì vậy không đúng.

**Tái hiện.** Script ở scratchpad, dùng dữ liệu thật của mùa `og-兵演春秋`:
- Đầu vào: kho có đủ đội `og-bingyan-40y-lvbu-b` trừ chiến pháp "Dẫn Huyền Lực Chiến". Kho có "An Ủi Quân Dân", và món này được chọn làm món bù cho đúng ô đó.
- Độ phủ kho (Gợi ý đội) cho `missingCount = 0`, tổng Ráp đủ = 1.
- Danh sách cho `missingCount = 1`, `summary = {complete: 0, total: 25}`.
- Kết quả: badge hiện "Thiếu 1 món", tóm tắt hiện "0 / 25", còn Gợi ý đội báo đội này ráp đủ. Lọc `kho=rap-duoc` loại mất đội này.

**Mâu thuẫn trong plan.**
- Phase 3, mục Hợp đồng ghi "không áp `tacticOverrides`".
- `plan.md`, Success Criteria #1 yêu cầu số "Ráp được" bằng tổng "Ráp đủ" của Độ phủ kho cho cùng mùa và cùng kho.
- Test node `roster-list-coverage.test.mjs` ("số ráp được khớp…") và e2e "tóm tắt bằng tổng Ráp đủ…" đều dùng kho không có món bù, nên không bắt được lỗi này.

**Hướng sửa nếu anh chọn giữ tiêu chí #1.**
- `readOwnedRoster` trả thêm `tacticOverrides`.
- `buildListCoverage` gọi `applyTacticOverrides(season.teams, roster.tacticOverrides)`. `teamId` của override chính là `sourceConfigId`, nên khóa `byConfigId` không đổi.
- Thêm một test node có món bù.

**Phương án còn lại.** Giữ nguyên code, nhưng sửa tiêu chí #1 và lời ghi ở đầu module thành "không tính món bù".

---

## Nên sửa

### F2. Quay lại từ trang chi tiết khi URL có `kho`/`xep`: mất thẻ đích, focus và thẻ đang mở [đọc]

- `js/app.js:527-544`: IIFE nạp kho dừng ở `await loadSession`, nên chạy tiếp sau `refresh()` (`:576`) và `restoreReturnState()` (`:580`).
- `js/team-filter-section.js:524-527,544`: lần render đầu chưa có `coverage`, nên `rosterOrder = null`. Khi `setRoster(fn)` tới, `key` đổi, `shown` bị đặt lại về `PAGE_SIZE` và `renderView()` thay toàn bộ node.

**Tái hiện.**
1. Mở `/doi-chuan/?xep=de-rap` (hoặc `?kho=thieu-2`) với kho có sẵn.
2. Bấm "Xem thêm" 2 lần, mở phần thay thế của một thẻ.
3. Mở chi tiết thẻ thứ 130, rồi bấm Back (trường hợp không có bfcache).

Kết quả:
- `setDisclosureState` dựng danh sách chưa lọc/chưa sắp tới vị trí thẻ đích, mở `details` và focus.
- Sau đó `setRoster` thay toàn bộ node: focus rơi về `BODY`, `details` đóng lại, chỉ còn 60 thẻ.
- `scrollTo(snapshot.scrollY)` chạy trong `requestAnimationFrame` trên một danh sách đã khác. Microtask của từ điển đã cache xong trước rAF.
- Người dùng còn thấy danh sách nháy từ thứ tự mặc định sang thứ tự sắp.

Trường hợp không có `kho`/`xep` thì không bị, vì nhánh `sameList` giữ nguyên node.

**Hướng sửa.** Hai cách:
- Ghi `disclosures` vào section, rồi áp lại trong `setRoster` khi danh sách bị dựng lại.
- Hoặc gọi `restoreReturnState()` sau `setRoster` khi URL có `kho`/`xep`.

Nên thêm e2e cho luồng này.

### F3. Tên món thiếu trong `title` bản zh có thể lẫn tiếng Việt [đọc]

`js/roster-list-badges.js:32`: `sourceName(vi) || sourceName(item.name) || vi`.

- Bản zh mà không tra được tên Hán (`sourceName` trả `''`), hoặc bộ tra tên Hán không nạp được (`app.js:219` và `season-page-roster-badges.js:59` đều `.catch(() => null)`), thì lùi về `vi`. Kết quả là chuỗi kiểu `缺少：武将Tào Tháo、战法…`.
- Điều này đi ngược đúng hợp đồng của `sourceName` (`recommended-reference-state.js:37`: "không trộn tiếng Việt vào trang zh").
- E2e zh (`doi-chuan-roster-badges.spec.mjs:160`) chỉ kiểm chữ badge, không kiểm `title`.

**Hướng sửa.** Ở zh, tên không tra được thì bỏ tên, chỉ giữ loại món (`武将`/`战法`), hoặc dùng ký hiệu "—". Thêm assert `title` không chứa chữ Latin có dấu.

### F4. bfcache có thể giữ badge của tài khoản vừa đăng xuất [đọc, chưa kiểm trang có vào bfcache không]

- `js/app.js:588`: `pageshow` với `persisted` chỉ gọi `restoreReturnState()`, không đọc lại kho.
- `signOut()` (`community-api.js:274-286`) xoá cache cloud rồi `location.reload()` trang hiện tại. Còn trang `/doi-chuan/` nằm trong bfcache thì vẫn giữ DOM badge, tóm tắt và closure `roster` của người A.

**Tái hiện.**
1. Người A đăng nhập, mở `/doi-chuan/` (có badge).
2. Mở chi tiết một đội, đăng xuất ở header.
3. Người kế tiếp bấm Back.

Kết quả: thấy badge và "ráp được X / Y" của A.

Mức độ dữ liệu lộ thấp: chỉ là đội nào ráp được, không có danh sách kho. Nhưng điều này trái ràng buộc "không bao giờ đọc kho của người khác".

**Hướng sửa.** Khi `pageshow` có `persisted`, chạy lại khối nạp kho (`readOwnedRoster` + `setRoster`).

### F5. `.reference-roster-bar[hidden]` vẫn hiển thị; Đội khác có thêm khoảng trống 12px [đọc]

- `css/styles.css:3639`: `.reference-roster-bar { display:flex }` của tác giả đè `[hidden]{display:none}` của trình duyệt. Repo không có quy tắc `[hidden]` toàn cục; các khối khác đều tự thêm `X[hidden]{display:none}`, ví dụ `:724`, `:3945`.
- Thanh "ẩn" vẫn là một flex item rỗng trong `.reference-results-body` (`display:flex; gap: var(--space-12)`), nên đẩy danh sách xuống thêm một khoảng `gap`.
- Bị ảnh hưởng: trang Đội khác (`family==='other'`, thanh luôn "ẩn"), Đội chuẩn trong lúc chưa biết kho, mùa `all`, và khi lỗi phiên.

Đây là hồi quy bố cục nhỏ cho người không có kho và ở trang Đội khác.

**Hướng sửa.** Thêm `.reference-roster-bar[hidden]{display:none}`.

---

## Gợi ý

### G1. `kho` vô hình, không xoá được ở mùa không có độ phủ [đọc]

`team-filter-section.js:339,344,520`: khi mùa đang xem có `summary.total === 0` (mùa `all`, mùa không có đội Giao chiến đã đối chiếu), thanh kho ẩn và bộ lọc bị bỏ qua. Nhưng `kho` vẫn nằm trên URL (`canonicaliseRosterParams` giữ lại, `app.js:441-452`), và nút "Xóa lọc" bị vô hiệu vì `activeFilterCount` không đếm `kho`.

**Tái hiện.** Ở `?kho=rap-duoc`, đổi mùa sang "Tất cả", rồi đổi sang một mùa khác. Bộ lọc tự bật lại mà người dùng không thấy nó tồn tại ở bước giữa.

Hai cách xử lý: gỡ `kho`/`xep` khi canonical hoá nếu không có `coverage`, hoặc chấp nhận và ghi rõ hành vi này.

### G2. Hai mẫu số khác nhau trên cùng màn hình [đọc]

- Tóm tắt ghi "ráp được X / **Y** đội của mùa này", với Y = số đội Giao chiến đã đối chiếu (`roster-list-coverage.js:74`).
- Ô đếm ghi "N / **M** đội", với M = mọi đội của mùa.
- Ví dụ mùa `og-兵演春秋`: Y = 25 nhưng M lớn hơn. Chữ "đội của mùa này" làm người đọc hiểu Y là toàn bộ mùa.

Nên đổi chữ (ví dụ "đội Giao chiến") hoặc ghi chú nhỏ.

### G3. Tên món thiếu chỉ nằm trong `title` [đọc]

`title` của `span` không focus được, nên không đọc tin cậy bằng trình đọc màn hình và không xem được trên cảm ứng (390px). Thông tin "thiếu gì" không tới được người dùng mobile. Chữ "Thiếu N món" thì đọc được, vì nằm trong `th scope=row` hoặc `.reference-card-title`.

Có thể để sau, nhưng nên tạo issue.

### G4. `role="status"` của tóm tắt bị tạo lại ở mỗi lần render [đọc]

`team-filter-section.js:357-360`: mỗi phím gõ tìm kiếm thay node `p[role=status]` mới. Tuỳ trình đọc màn hình, việc này hoặc không bao giờ thông báo, hoặc thông báo lặp lại.

Nên giữ một node cố định và chỉ đổi chữ khi `summary` đổi.

### G5. Lỗi của `rosterSource` làm hỏng cả lượt render [đọc]

`team-filter-section.js:519`: `rosterSource(state.season)` chạy đồng bộ trong `render()`. Nếu `buildSeasonCandidates` ném lỗi ở một mùa (dữ liệu hỏng), `render` của lượt đổi mùa ném lỗi theo. Danh sách giữ trạng thái cũ, URL đã đổi.

Lúc nạp đầu có `.catch` ở `app.js:541`, nhưng các lần đổi mùa sau thì không. Nên bọc try/catch trong `setRoster`, lỗi thì trả `null`.

### G6. Trang mùa cũ: nhận mùa từ thẻ đầu tiên có thuộc tính [đọc]

`season-page-roster-badges.js:48`: `[data-source-config-id]` khớp cả giá trị rỗng. Thẻ cũ không có `sourceConfigId` được render `data-source-config-id=""` (`recommended-reference-render.js:452`). Nếu thẻ đầu là thẻ như vậy, `firstKey` bằng `""`, không có badge, và không báo lỗi.

Dữ liệu hiện tại nhiều khả năng không có trường hợp này. Dùng `[data-source-config-id]:not([data-source-config-id=""])` cho chắc.

### G7. Hiệu năng [đọc]

Không có vấn đề thật:
- Độ phủ được nhớ theo mùa (`app.js:533-538`).
- `decorateCoverageBadges` duyệt mọi thẻ đã hiện ở mỗi lần render hoặc "Xem thêm". Tổng là O(shown) mỗi lần, tối đa khoảng 1.366 thẻ, chấp nhận được.
- Trang mùa cũ tải thêm `other-teams.json` (khoảng 127 KB) qua `loadRecommendedReference` dù không dùng tới. Chỉ xảy ra khi máy có kho.

---

## Những gì đã kiểm, không thấy lỗi

- **Rò kho trên máy chung (luồng bình thường):**
  - `readOwnedRoster` chỉ đọc cache cloud khi `raw.userId === userId` (`normalizeCloudState`, `roster-cloud-store.js:135`).
  - Khách không đọc cache cloud.
  - Đăng xuất thì xoá cache và tải lại trang.
  - Phiên hết hạn (`/api/me` trả `user: null`) thì rơi về kho local, cùng luật với Gợi ý đội (`roster-recommend-ui.js:384`).
  - Test node có đủ 4 ca này.
- **`family === 'other'`:**
  - `referenceSectionState` ép `rosterFilter`/`rosterSort` về `null`.
  - Không gọi `setRoster`.
  - `canonicaliseRosterParams` gỡ `kho`/`xep`.
  - Chỉ còn hồi quy CSS ở F5.
- **Không có kho:**
  - Nhánh `sameList` giữ nguyên node dựng sẵn.
  - `rosterOrdered` chặn việc nhận lại DOM dựng sẵn khi đang sắp/lọc.
- **"Xem thêm":**
  - `appendNextPage` gắn badge cho các node mới.
  - `de-rap` sắp theo `tierOrder` trước, cùng khóa với `fixedRank`, nên `groupRowsByTier` vẫn nối đúng nhóm bậc.
- **`popstate`:** độ phủ đã nhớ theo mùa, `render` đồng bộ, nên không có race như F2.
- **`aria-pressed`:** nút kho có `aria-pressed`, nằm trong `role=group` có `aria-label`. Focus giữ theo `data-focus-key` khi dựng lại.
- **#59:** `replaceChildren(...[])` đúng. Đã thêm assert e2e "không có chữ null".

## Lỗ hổng test

1. Kho có `tacticOverrides`: chưa có test parity giữa danh sách và Độ phủ kho (F1).
2. Back từ trang chi tiết với `kho`/`xep` trên URL, kèm "Xem thêm" và `details` đang mở (F2).
3. `title` bản zh không có chữ Việt (F3).
4. Người đã đăng nhập dùng cache cloud ở e2e. Hiện chỉ có test node, e2e chỉ seed kho local.
5. "Xem thêm" khi đang `xep=de-rap`: thẻ của lượt sau có badge và nằm đúng nhóm bậc.
6. Đổi mùa khi đang bật `kho` (G1). `popstate` giữa có và không có `kho`.
7. Trang Đội khác không có `.reference-roster-bar` hiển thị và không lệch bố cục (F5).

## Câu hỏi chưa giải quyết

1. F1: giữ tiêu chí #1 (áp món bù) hay giữ quyết định "không áp `tacticOverrides`" của phase 3 rồi sửa tiêu chí và lời ghi module?
2. G1: `kho`/`xep` có nên tự gỡ khỏi URL khi mùa đang xem không tính được độ phủ không?
3. G3: có cần hiển thị danh sách món thiếu ngoài `title` (cho mobile) trong đợt này, hay tạo issue riêng?
