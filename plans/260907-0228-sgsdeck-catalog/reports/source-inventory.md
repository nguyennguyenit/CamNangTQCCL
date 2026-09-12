# SGSDeck source inventory

Khảo sát live: 2026-09-12, Asia/Ho_Chi_Minh. Phạm vi chỉ các trang công khai,
không đăng nhập, không dùng cookie/account và không bypass giới hạn.

| Nhóm | Entry point/final URL | Inventory quan sát | Cơ chế nguồn |
|---|---|---:|---|
| generals | `https://sgsdeck.com/generals` | 202 | Next flight có list + upstream ID; 176 military record có detail link, 26 internal record chỉ ở list. Mẫu detail `40Y呂布`. |
| tactics | `https://sgsdeck.com/tactics` | 393 | Next flight chứa field list đầy đủ như source/kind/quality/effect/troop/rate/season; không thấy pagination hoặc detail link. |
| equipment | `https://sgsdeck.com/equipment` | 114 item | Server-rendered card, tab item theo slot/quality; `?tab=specials` quan sát 90 special riêng. |
| advisors | `https://sgsdeck.com/advisors` | 39 | Next flight chứa element/points/effect/season và general liên quan; filter client-side, không thấy pagination/detail link. |
| troop-mods | `https://sgsdeck.com/troop-mods` | 16 parent / 192 option | Next flight chứa season `兵演春秋`, tactic parent và option children; chọn tactic/filter client-side. |
| buildings | `https://sgsdeck.com/buildings` | 41 parent | List có category, slug, max/fill level; 41 detail page chứa bảng level. Mẫu detail `jun-wang-dian`. |

Tất cả sáu entry point trả HTTP 200 và giữ cùng URL cuối trong lượt kiểm. Không
thấy pagination ở list. Equipment special là tab query cùng path; general và
building detail dùng path con cùng category. Allowlist dự kiến chỉ host
`sgsdeck.com`, sáu path entry point, query tab/filter đã inventory và detail path
được phát hiện từ chính list snapshot; redirect ra host khác phải dừng.

Mẫu acceptance thật đã xác nhận: `40Y 呂布`, `SP 典韋`, internal general
`司馬徽`; tactic `一身是膽`; equipment `丈八蛇矛` + tab special; advisor
`仁心得眾` gắn `劉備`; troop-mod `大戟士` với option `持槍`; building
`君王殿` nhiều cấp. Variant CO/無雙 xuất hiện riêng trong list general.

## Reuse gate

Ngày 2026-09-12, chủ project xác nhận trực tiếp rằng mình có quyền import dữ
liệu trong phạm vi sáu catalog của plan này. Xác nhận này mở gate lưu và xử lý
snapshot chuẩn hóa trong project; không được diễn giải thành open license của
SGSDeck hoặc quyền tái phân phối không giới hạn ngoài phạm vi đã xác nhận.

[Điều khoản SGSDeck](https://sgsdeck.com/terms) hiển thị cập nhật 2026-08-20,
nêu quyền của site với structured data đã tổng hợp và cấm bulk/mirror phục vụ
mục đích thương mại khi chưa được phép. Không có open license hoặc export công
khai được xác minh trong lượt khảo sát.

Quyết định Kongming sau xác nhận trên: GO import sáu catalog theo scope đã chốt.
Vẫn giữ allowlist, timeout, tốc độ hữu hạn và dừng nếu gặp authentication hoặc
rate-limit; không lấy tài khoản, đội người dùng, bài viết, ảnh hay mã nguồn.
Bulk acquisition không tự làm snapshot hợp lệ: chỉ promote sau khi đủ sáu output,
coverage và semantic validation đều đạt.

Coverage live hiện khớp baseline 805 parent, cộng 192 troop options và 90
equipment specials. Đây là số quan sát 2026-09-12, không phải hằng số parser.

## Imported snapshot

Owner-authorized snapshot đã nhập và validate đủ 805 parent + 708 child:

| Nhóm | Parent | Child/detail coverage |
|---|---:|---:|
| generals | 202 | 176 detail; 26 list-only theo upstream |
| tactics | 393 | 0 child |
| equipment | 114 | 90 special; 57 linked, 33 unlinked |
| advisors | 39 | 0 child |
| troop-mods | 16 | 192 option |
| buildings | 41 | 426 level |

Flight payload cung cấp 114 upstream equipment ID. Deferred refs của `古錠刀`
resolve thành quality `橙` và slot `武器`; snapshot không còn equipment thiếu
hai field này. Canonical mapping exact-Chinese tạo 39 general + 40 tactic ref;
không fuzzy auto-merge và không tự xác nhận bản Việt.
