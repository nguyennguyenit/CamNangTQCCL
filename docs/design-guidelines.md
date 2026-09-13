# Hướng dẫn thiết kế giao diện

## Tổng quan

Giao diện là dashboard dữ liệu tĩnh: nhanh, rõ, gọn. Card, badge và chip giúp quét thông tin; interaction phải hoạt động trên mobile và không che dữ liệu sau nhiều lớp UI.

## Cấu trúc trải nghiệm

8 section cùng một shell header/navigation. Hash URL giữ deep-link. Mỗi section nên có intro ngắn, control chính và nội dung ngay sau đó; tránh dashboard trang trí không phục vụ quyết định.

Các tab Theo dõi chiêu mộ, Soi đội từ ảnh và Gợi ý đội từ kho hiển thị nhãn `Beta` cạnh tên trong navigation desktop và menu mobile.

| Nhóm | Pattern hiện tại |
|---|---|
| Team chuẩn / Team khác | Shared inline search + dynamic chip groups + card grid |
| Cùng Tồn / Khai hoang | Nhóm card và bảng dữ liệu local |
| Tra cứu | Một search, sáu chip nhóm, card grid có paging và dialog hồ sơ |
| Tracker | Account/banner/slot/action nhỏ gọn, lịch sử và import/export |
| Soi đội | Drop-zone, preview, Turnstile, trạng thái, kết quả match |
| Gợi ý kho | Scan theo loại, review canonical data, portfolio và diagnostics |

## Shared team filter

- Dùng `team-filter-section.js` cho cả hai tab; wrapper chỉ chọn source, groups và sort.
- Search toàn văn bao phủ tướng, chiến pháp và binh thư. Không thêm combo trùng chức năng nếu search đủ.
- Chip count được tính từ tập team của tab; nhóm có dưới hai giá trị tự ẩn.
- `Xóa lọc` phải reset query, sets, chip state và selected tags.
- Trên mobile, `.team-filters.collapsed` ẩn nhóm sau nút `☰ Bộ lọc`; đây là inline collapse, không phải drawer/module riêng.
- Menu section mobile do `mobile-section-menu.js` quản lý, tách khỏi filter collapse.

## Tra cứu thống nhất

`Tra cứu` là một tab cho sáu nhóm; không tạo lại tab tướng/chiến pháp riêng.
`#heroes` và `#tactics` là alias tương thích, còn link canonical dùng `#lookup`
với `group`, `q` và `id` khi cần. Search chạy toàn corpus, bỏ dấu tiếng Việt và
đọc alias Hán đã review. Sáu chip nhóm là button có `aria-pressed`; navigation
chính là `tablist`/`tab` điều khiển được bằng phím mũi tên.

Grid hiển thị tối đa 60 kết quả mỗi lượt và phải có `Xem thêm` để tới record
cuối. Card mở dialog hồ sơ theo canonical ID; dialog trap focus, đóng bằng
Escape/nền/nút đóng và trả focus về trigger. Quan hệ tướng–chiến pháp cùng
equipment special, troop option và building level phải đi qua ID đã validate,
không ghép theo text. Trường thiếu hiển thị “Đang cập nhật”; không biến `0` hoặc
`false` thành dấu gạch.

Lỗi lookup phải cụ thể trong đúng section và khóa các feature thật sự phụ thuộc,
không làm mất Team chuẩn hay nội dung local độc lập. Catalog không hiển thị
provenance/source nội bộ. Team chuẩn/Team khác vẫn giữ link nguồn và điểm đã
review theo contract riêng. Ma trận hành vi nằm ở
[`tests-e2e/unified-lookup.spec.mjs`](../tests-e2e/unified-lookup.spec.mjs).

## Tra cứu theo kịch bản

Chọn kịch bản và phiên bản luật ở control dùng chung; Khai hoang giữ bản bảo trì
mới nhất. Chỉ chọn kịch bản là đọc tham khảo, chưa đủ để gợi ý hoặc so đội theo
luật. Phân biệt vùng áp dụng đúng luật, tham khảo cùng kịch bản và chưa rõ kịch
bản; mỗi vùng có số lượng riêng. Phạm vi rỗng không lấy dữ liệu mùa khác thay thế.

URL giữ phạm vi, search/filter và cấu hình đang mở; back/forward phải phục hồi
đúng trạng thái. Mở lại URL chỉ có kịch bản không tự chọn luật. Đổi phạm vi giữ
kho nhưng yêu cầu xác nhận lại và bỏ kết quả cũ. Khi bộ dữ liệu mùa không xác
thực được, hiển thị thông báo tham khảo legacy và khóa thao tác theo mùa.

Card và chi tiết thuộc đúng cấu hình; chi tiết giữ thứ tự holder, chiến pháp,
binh thư, điều kiện và nguồn. “Điểm SGSDeck” là điểm nguồn của lựa chọn khớp,
có thể lớn hơn 100; thiếu bằng chứng ghi “Chưa có điểm SGSDeck”. Tier legacy
ghi “Tier lịch sử — tham khảo”, không coi là tier mùa đang chọn. Bỏ sao đánh
giá đội; sao phẩm chất tướng vẫn có ý nghĩa riêng.

Cùng Tồn giữ ghi chú nhiều dòng và các slot nguồn dưới dạng text. So kho nêu
tài nguyên thiếu/đang khóa và điều kiện chưa xác minh; đủ tướng/chiến pháp
không chứng minh binh thư hoặc điều kiện đặc biệt đã thỏa. Điều kiện tùy chọn
chưa xác minh chỉ là thông tin, không được diễn đạt như điều kiện chặn bắt buộc.

Control phải có focus rõ, giữ focus khi toggle filter và khi đóng chi tiết;
chi tiết không bị header che. Nguồn hành vi nằm ở
[state adapter](../js/season-ui-state.js), [renderer](../js/render.js) và
[kiểm thử trình duyệt](../tests-e2e/season-lookup.spec.mjs).

## Hierarchy, màu và typography

- Tiêu đề section rõ hơn subtitle; stats/filter là secondary; nội dung card là primary.
- Giữ palette phe và badge status/tier hiện có để người dùng nhận diện nhanh.
- Không dùng màu là tín hiệu duy nhất: badge phải có text/tier/status.
- Label, button, error và empty state dùng tiếng Việt ngắn, cụ thể.
- Spacing giữa intro, filter và grid phải ổn định giữa hai tab team.
- Motion tối thiểu; tôn trọng `prefers-reduced-motion` khi thêm animation.

## Responsive và touch

- Mobile-first: một cột/card vừa viewport, control wrap hợp lý, không cần hover.
- Chip/button/drop-zone có touch target đủ lớn và focus-visible rõ.
- Section không phải team vẫn dùng full content width khi phù hợp.
- Không tạo horizontal scroll cho filter, tracker hoặc bảng; nếu bảng bắt buộc rộng, cung cấp container scroll rõ.
- Theme sáng/tối giữ contrast và không làm mất meaning của faction/tier/status.

## Accessibility contract

Hiện có button semantic, một số ARIA, alt text và `aria-expanded`. Khi chạm UI liên quan, hoàn thiện các gap sau:

- section navigation dùng `tablist`/`tab`/`tabpanel`, trạng thái selected và keyboard arrows;
- modal trap focus, Escape để đóng, trả focus về trigger;
- drop-zone có `tabindex`/button semantics và Enter/Space activation;
- trạng thái nén/upload/analyze/error dùng live region phù hợp;
- menu/filter collapse đồng bộ `aria-expanded` và control target;
- mọi image informative có alt; decorative image dùng alt rỗng.

Không tuyên bố accessibility hoàn chỉnh trước khi các contract trên có kiểm thử.

## Local-first tracker

- Giải thích dữ liệu lưu trong trình duyệt hiện tại và có thể mất nếu clear storage.
- Đặt `Xuất JSON`/`Nhập JSON` gần luồng backup/restore, có validation và confirm trước ghi đè.
- Pity, lượt còn lại và lịch sử 5★ phải dùng nhãn số rõ, không chỉ màu.
- Account/banner destructive action cần guard chống xóa nhầm.
- Không gửi tracker data ra Worker hoặc provider nếu không có feature/user consent mới.

## Soi đội từ ảnh

- Luôn hiển thị disclaimer: ảnh gửi tới Alibaba Cloud DashScope, không chủ động lưu; khuyến nghị crop tên account.
- Preview giúp người dùng xác nhận ảnh trước gửi; trạng thái nén, Turnstile, upload và lỗi phải tách bạch.
- Tên đoán từ portrait hoặc confidence thấp phải gắn cờ `kiểm tra`.
- Kết quả canonical Việt và icon chỉ là hỗ trợ đối chiếu; icon lỗi không được làm mất text.
- Team tương tự hiển thị số tướng/chiến pháp trùng; người dùng có quyền mở team nguồn để kiểm tra.
- Không diễn đạt quota KV như giới hạn tuyệt đối.

## Gợi ý đội từ kho

- Quy trình bắt buộc: scan → map canonical → người dùng review/sửa → xác nhận → recommend.
- Phân biệt rõ team đã khóa, portfolio sau build, team nên thêm, missing hero/tactic và conflict.
- Nói rõ AI chỉ đọc screenshot; local engine dùng data curate để chọn team.
- State persist chỉ chứa tên/thuộc tính cần thiết; không ảnh, base64, blob hoặc Turnstile token.
- Cho phép người dùng quay lại review mà không phải scan lại ảnh nếu canonical state còn hợp lệ.

## Content safety và error state

- Render dữ liệu bằng DOM/text, không inject HTML nguồn.
- Empty state nói bộ lọc không có kết quả và giữ control để người dùng reset.
- Network/provider error không đổ raw upstream message nhạy cảm.
- Disclaimer dữ liệu meta phải nhắc đây là nguồn tham khảo, không phải phương án duy nhất.

## Không nên làm

- Không thêm framework-looking component chỉ để đổi thẩm mỹ.
- Không tạo filter UI khác nhau cho hai tab cùng contract.
- Không tham chiếu `facets.json` như runtime source hoặc module mobile drawer không tồn tại.
- Không giấu privacy notice, scan review hoặc conflict diagnostics.
- Không để AI wording khiến người dùng hiểu model tự sáng tạo đội.

## Bước tiếp theo

Ưu tiên tab semantics, modal focus, keyboard drop-zone và live regions; sau đó audit contrast/touch target trên cả light/dark và mobile.

## Tham chiếu

- [PDR](project-overview-pdr.md)
- [System Architecture](system-architecture.md)
- [Code Standards](code-standards.md)
- [Roadmap](project-roadmap.md)
