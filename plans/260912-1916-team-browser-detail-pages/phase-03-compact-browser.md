---
phase: 3
title: "Thẻ compact, bộ lọc điểm và mùa nguồn"
status: completed
priority: P1
effort: ""
dependencies: [phase-02-detail-pages]
---

# Phase 3 — Thẻ compact, bộ lọc điểm và mùa nguồn

## Goal and fresh scout

Team chuẩn/Team khác dùng nhịp thẻ và bộ lọc tqccl.com cũ, mở detail bằng anchor thật. Không dựng giao diện giống toàn bộ SGSDeck, không đổi các tab còn lại.

Bắt buộc scout lại source sau phase 2: `createRecommendedSection`, shared filter models/styles, card renderers, query serialization, handlers của navigation và root shell. Đặc biệt không dùng bản checkout main cũ: feature worktree đã có season/category controls và `.team-filters.collapsed`. Dùng LSP references nếu có server cho exported-symbol change. Viết Red trước đổi state/render/CSS.

## Files

Modify dưới root worktree [plan.md](plan.md):
- `js/team-filter-section.js`: bỏ season-search input, bố trí row search/season luôn nhìn thấy, dùng lại nút Bộ lọc và group patterns có sẵn; counts, score disclosure, secondary facets.
- `js/recommended-reference-state.js`: score facet parsing/serialization/projectors, scoped counts và explicit search haystack. Giữ `resolveTeamDestination` identity contract đã migrate ở phase 2.
- `js/recommended-reference-render.js`: compact styling cho title/CTA anchors đã hoạt động từ phase 2, numeric top-right, full holder/alternatives/counter content; bỏ Tier và card scope caption.
- `js/app.js`: hợp đồng state/snapshot sau score migration, không sửa gameplay.
- `css/styles.css`: stylesheet hiện hữu duy nhất; chỉ sửa rule team browser/card/filter cần thiết, không thêm bản trùng cạnh style cũ.
- `tests-js/recommended-reference-state.test.mjs`, `tests-e2e/recommended-browser.spec.mjs`, `tests-e2e/team-detail-pages.spec.mjs`; giữ legacy shared-filter regressions nếu hành vi không đổi.

## Query/filter contract

Giữ `season`, `category`, `q`; primary chip groups theo **Loại binh → Điểm → Phe**. Secondary category/subcategory/source vẫn truy cập trong vùng Bộ lọc, không tạo hệ top-level category tabs mới. Bộ chọn mùa là click-only native select có nhãn truy cập; **không có input “Tìm mùa”**. Search “Tìm đội, tướng, chiến pháp, binh thư” và season nằm ngoài container collapsed trên mobile.

`score` mới là repeated query key, nhận số nguồn finite không âm theo canonical numeric text, hoặc token `unknown`. Ví dụ `score=113&score=105`, `score=unknown`. Không dùng range/bucket suy diễn và không nhận Tier/4.5-star dưới dạng điểm. Null/missing → chip “Chưa có điểm nguồn”; 0 là điểm thật, khác unknown. Display number giữ độ chính xác nguồn, không tự làm tròn.

OR trong cùng facet, AND giữa facets và q. Counts lấy từ rows của family + season/category trước q/facet filters, như cơ chế scoped legacy; counts không thay đổi thành con số phụ thuộc search giữa hai group khác nhau. Unknown source season/category vẫn có option và empty/uncollected state phân biệt rõ; đổi season/category clear selection detail cũ nhưng không chuyển pending vào admitted.

Danh sách điểm sắp số giảm dần, unknown cuối. Tối đa 8 mức đầu nhìn thấy khi group thu gọn; mức đang chọn ngoài 8 luôn nhìn thấy. Khi nhiều hơn, nút “Xem tất cả mức điểm (N)”/“Thu gọn” chỉ điều khiển presentation, không bỏ giá trị, không ảnh hưởng counts/kết quả. Không có numeric textbox hoặc ngưỡng 90/100 tự đặt. Mobile còn lớp Bộ lọc collapsed tổng, aria-expanded/controls đúng ở cả hai cấp. Active chips và clear có trạng thái truy cập được; Phe giữ màu theo UI cũ.

Old `tier`/star/filter aliases: loại khỏi team-browser query, thông báo rằng bộ lọc cũ không còn áp dụng; **không map Tier sang score**. Không loại tier/star trong các module gameplay/hero không liên quan. Repeated valid score values canonical/de-duplicate; malformed/negative/Infinity/ambiguous input bị bỏ có notice, không crash hoặc coi là 0.

Không thay comparator xếp hạng hiện có: fixedRank vẫn ổn định theo source Tier/value/listIndex/ID; chỉ bỏ **trình bày** Tier/group headings. Đây không phải tính ranking mới hoặc yêu cầu sort theo điểm. Query score chỉ filter, không reorder. Full text dùng trường domain rõ: tên Việt/raw, nickname, loại binh/phe, heroes/tactics/books Việt/raw, alternatives, notes và good/avoid labels từ legacy gốc hoặc reviewed linked content. Không dùng JSON.stringify để fingerprint/evidence URLs vô tình match search. Reuse normalizeText/teamSearchBlob principles từ `js/filters.js`; counter chip gọi onTag/query như cũ, không mở detail. Không tạo cách fold chữ thứ hai.

## Card/layout contract

Desktop 1440px: 4 cột khi mỗi thẻ đọc đủ nội dung. Dùng breakpoint/grid hiện có làm gốc, chuyển 3/2 ở bề rộng nhỏ hơn; mobile 375px một cột và kiểm tra biên 320px, không horizontal overflow. Không khóa card height hoặc giảm font để cố đạt 4 cột ở mọi width.

- Title Việt là anchor; CTA **Xem chi tiết** là anchor tới cùng route (kể cả variant và safe from). Normal click same-tab, Ctrl/Cmd/middle vẫn native. Không làm toàn card thành fake button có nested interactive targets; hero modal/alternative control còn hoạt động, bấm chip chiến pháp không điều hướng đội.
- Điểm số thật ở góc phải trên; title có đủ chỗ wrap và point không đè text. Missing score hiển thị nhãn trung tính, không badge 0.
- Bỏ Tier badge, Tier header và sao dùng để đánh giá team. **Không xóa rarity stars của hero toàn cục.**
- Bỏ hẳn caption scope dưới card (`OG · Binh Diễn Xuân Thu · Giao chiến` và các biến thể khác), không thay bằng bản rút gọn. Giữ metadata ở state/detail và giữ scope notice phân biệt rỗng/chưa thu thập; không xóa mọi `.scope-note` trên toàn app.
- Card có nhãn loại binh và phe Việt nhìn thấy được, đúng badge/color conventions của `js/render.js` cũ; không chỉ data attributes hoặc facet labels. Có ba holder, vai trò và SP/CO/40Y badges, chiến pháp/binh thư, phương án thay ngắn gọn và good/avoid counter chips từ dữ liệu thật. Không di chuyển nội dung này sang detail để làm card nhỏ giả tạo; không tái tạo scope caption bị cấm.
- Tên dài xuống dòng đọc được; danh sách thay thế quá dài dùng disclosure có nhãn/số lượng và mở được, không cắt mất thông tin. Notes dài nằm ở detail, không nhét nguyên narrative lên card.
- Bond `Kết Nghĩa Vườn Đào` tách khỏi tactic selectable và không đổi tên đã duyệt. CO Vô Song Đại Kiều/Tiểu Kiều/Tinh Thái giữ đúng prefix/name, không suy luận lại từ raw text.

## TDD

**Red** trên UI/state trước source edit:
- **B1:** số >100, số thập phân, 0 và unknown filter đúng; score repeats OR, unit/faction AND; source/category/subcategory không mất, stable order và scoped counts giữ đúng.
- **B2:** accented/unaccented Vietnamese và Chinese tìm cùng đội qua title/hero/tactic/book/alternative/notes/counter labels; hash/evidence-only string không tạo false match. Counter-only “team TMY” trong Tân Ngô Thương vẫn match khi click chip, không loại đội gốc khỏi kết quả.
- **B3:** season select luôn thấy trên mobile và đổi được; không season-search input; Bộ lọc collapse không giấu search/season. Empty-category và uncollected-season khác no-results vì chips.
- **B4:** title và CTA mở cùng dedicated URL; numeric top-right, không card Tier/scope caption; nhãn loại binh/phe Việt có màu, holders/tactics/books/alternatives/counters/bond/badges đầy đủ. Keyboard link/facet/disclosure hoạt động; chip chiến pháp/hero/alternative/counter không trigger team navigation; counter chip giữ hành vi search.
- **B5:** fixture có ít nhất 36 scores, chọn giá trị ngoài 8 rồi thu gọn vẫn thấy/clear được; disclosure không thay results; unknown không bị gộp với 0. Query cũ/malformed thông báo mà không sửa gameplay state.
- **B6:** 1440 bốn cột, 375 và biên 320 một cột; long title, unit/faction/variant badges, alternatives và counters không đè, cắt hoặc overflow. Test behavior/bounding boxes có ý nghĩa, không pin toàn CSS/source strings.

**Green:** projector/serialization → filter DOM → compact card presentation trên anchors phase 2 → scoped responsive styles. Migrate assertions yêu cầu Tier/season text search; reference inline assertions đã migrate ở phase 2. Xóa test chỉ pin markup/wording incidental, không đổi chúng sang pin wording mới.

**Refactor:** xóa obsolete tier group/seasonSearch state và event listeners, không để API shim. Reuse current chip renderer/search folding và style ownership thay vì abstraction mới.

## Tasks and commands

- [x] P3.1 Fresh scout và Red B1–B6.
- [x] P3.2 Score/scoped filters, search và season controls.
- [x] P3.3 Compact complete cards, native links và responsive layout.
- [x] P3.4 Green và so sánh surface thật với tqccl.com baseline.

```sh
node --experimental-strip-types --test tests-js/recommended-reference-state.test.mjs tests-js/team-detail-navigation.test.mjs
npx playwright test tests-e2e/recommended-browser.spec.mjs tests-e2e/team-detail-pages.spec.mjs --project=astro
```

Exit: screenshot desktop/mobile/light/dark, filter mở/đóng, season OG và mùa nhiều điểm, title dài và card thiếu điểm. Mở trang chi tiết thật và quay lại sau khi filter/scroll. Screenshot + quan sát DOM phải chứng minh nội dung đọc được; assertions pass không thay visual review. Ghi chênh lệch với baseline có lý do trong report.
