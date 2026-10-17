# Nguồn tiếng Anh cho Three Kingdoms Tactics (Global/SEA)

- Research date: 2026-10-15 (giờ máy, +07)
- Session/run: chat 2026-10-15, multi-language planning
- Branch: source verification
- Topic lock: Nguồn tiếng Anh cho Three Kingdoms Tactics (Global/SEA)

## Objective

Tìm nguồn tiếng Anh dùng được cho (1) tên tướng/chiến pháp tiếng Anh chính thức
nếu làm bản site tiếng Anh, (2) build/meta bản Global. Không nhập dữ liệu,
không đổi tier/runtime.

## Scope

| Field | Value | How determined |
| --- | --- | --- |
| Server/region | Global / SEA (tiếng Anh) | Người dùng hỏi nguồn tiếng Anh sau khi bàn multi-language |
| Season | unknown | Không chỉ định |
| Patch/version | unknown | — |
| Capture date | 2026-10-15 | host metadata |

## Previous Conclusion and Corrections

- Previous claim: cộng đồng/web tiếng Anh ít phân tích gameplay có thể dùng.
- Previous reports: [research-260713-0111](research-260713-0111-bac-phat-thuong-da-thi-truong.md),
  [research-260825](research-260825-binh-dien-xuan-thu-global-only.md),
  [research-260906-1420](research-260906-1420-khaihoang-cn-global-meta-audit.md).
- Current state: still valid cho build/meta.
- New evidence: tìm được trang sự kiện tiếng Anh chính thức của Qookka có tên
  tướng/chiến pháp tiếng Anh; phát hiện video "Global Server" thuộc game khác.
- Replacement conclusion: không thay kết luận cũ; bổ sung nguồn tên chính thức
  và một bẫy nhầm game.

## Call Budget

| Topic | Allowance | Limit | Used | Remaining |
| --- | --- | ---: | ---: | ---: |
| Nguồn tiếng Anh TKT | External sources | 10 (5 mặc định + 5 khi người dùng yêu cầu tìm YouTube) | 10 | 0 |

Local reads (registry, reports, template) không tính.

## SGSDeck Status

Không áp dụng (xác minh nguồn, không phải build).

## Claim Evidence

| Claim | Status | Provenance | URL | Notes |
| --- | --- | --- | --- | --- |
| Qookka có trang sự kiện tiếng Anh chính thức "Customized Scenarios Season" dùng tên Anh: Wang Shuang, Man Chong, "Flood the Walls" (Active Tactics), "Fatigue Hunt" (Active Tactics) | Đã đối chiếu | external, đã đọc trang | https://sangokushi.qookkagames.com/prism-l0awzdr9/en | Mùa cũ (Customized Scenarios/Challenge Mode), ngày đăng unknown. Bài chi tiết ở `act.qookkagames.com/prism-ky9h9siq#/article/1137/10110…10117` chưa mở. Chưa ánh xạ tên Anh ↔ tên Hán/Việt. |
| Fanpage chính thức EN: facebook.com/Three-Kingdoms-Tactics-108271627744873; nhóm EN: facebook.com/groups/347143376634272 | Phương án từ nguồn | link từ trang chính thức trên | như trên | Chưa mở Facebook (cần đăng nhập). |
| Video "Three Kingdoms: Tactics Global Server S2 Guide" (awaqmvyhnXI) thực ra thuộc game khác (三國謀定天下), không phải TKT | Đã đối chiếu | external, đã đọc metadata | https://www.youtube.com/watch?v=awaqmvyhnXI | Tiêu đề thật: 《三國謀定天下》國際服W2, kênh 逃跑的阿桂, 2026-07-25. Registry đã ghi 三国谋定天下 là khác game. Kết quả search gán nhầm tiêu đề TKT. |
| Fandom wiki three-kingdoms-tactics.fandom.com có trang TACTICS, Officer Tier List (T0/T0.5) | Chưa xác minh | snippet | https://three-kingdoms-tactics.fandom.com/wiki/TACTICS | HTTP 403. Snippet có tên chiến pháp Anh như "Delayed Strike", "Feng Ji". |
| r/ThreeKingdomsTactics tồn tại, bài hướng dẫn 2021 | Chưa xác minh | snippet | https://www.reddit.com/r/ThreeKingdomsTactics | Không kết nối được. |
| Kênh YouTube "Three Kingdoms Tactics" (@threekingdomstactics7700) có Beginners Tutorial chương 1–5, livestream Discord | Chưa xác minh | snippet | https://www.youtube.com/@threekingdomstactics7700 | Chưa mở; không rõ chính thức hay cộng đồng. |
| Kênh "Thewayforward" (SG) làm video TKT tiếng Anh: hướng dẫn khởi đầu, phân tích map S5, Triệu Vân solo S3 | Chưa xác minh | snippet | https://www.youtube.com/watch?v=if-mpBck8Jc | Mùa đầu; ngày unknown. |
| Discord "Three Kingdom Tactics" ~194 thành viên | Chưa xác minh | snippet | https://disdex.io/server/786409174313599028 | Cộng đồng nhỏ. |

## Media Access

| Media | Accessed content | Not accessed | Claim impact |
| --- | --- | --- | --- |
| youtube awaqmvyhnXI | Tiêu đề, kênh, ngày, thời lượng | Nội dung video; không có phụ đề | Đủ để xác định sai game |
| Các video YouTube khác | Không | Toàn bộ | Chưa xác minh |

## Comparison and Constraints

- Không tìm thấy kênh/bài tiếng Anh có build theo mùa hiện tại (Binh Diễn Xuân Thu).
- Kết quả search "Three Kingdoms Tactics" lẫn nhiều game khác (Total War: Three
  Kingdoms, 三国谋定天下, Rise of Kingdoms). Phải kiểm tiêu đề gốc/kênh trước khi dùng.
- Global applicability: tên trên trang chính thức thuộc bản Qookka tiếng Anh;
  chưa xác nhận bản `.gp.global` và `.gp.sea` dùng cùng bản dịch.

## Conclusion

Nguồn tiếng Anh cho build/meta vẫn mỏng như các báo cáo trước. Nguồn hữu ích nhất
cho bản site tiếng Anh là trang/bài sự kiện chính thức của Qookka (tên chính thức),
cộng với client game. Fandom wiki là đầu mối tên gọi, chưa đọc được.

## Limits and Unresolved Questions

- Fandom, Reddit, Facebook không truy cập được.
- Chưa xem nội dung video nào.
- Chưa biết các bài `act.qookkagames.com` còn mở, có danh sách tên đầy đủ không.

## Next Step

Mở các bài `act.qookkagames.com/prism-ky9h9siq#/article/1137/…` (trang SPA, có thể
cần browser) để xem có danh sách tên chiến pháp tiếng Anh không; thử Fandom qua
browser hoặc archive.org.

## Final Validation

- [x] Scope and its provenance are explicit or unknown.
- [x] Prior reports and corrections were checked.
- [x] Every material claim has exactly one allowed status.
- [x] Media access is stated precisely.
- [x] Topic, limit, used, and remaining are reported.
- [x] No unauthorized mutation, tier change, Git action, or deployment occurred.
