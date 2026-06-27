# Research Report: Team Đô Úy (都尉) bảng Anh Hùng Mệnh Thế — bổ sung từ JP / KR / CN

> Thực hiện: 2026-06-27 02:0x (Asia/Saigon). Phương pháp: WebSearch ×4 + WebFetch ×2. Gemini CLI fail (thiếu `GEMINI_API_KEY`) → fallback WebSearch theo quy trình skill.
> Đối chiếu với 31 team trong `pipeline/do-uy-ss18-source.json`.

## Executive Summary

- **"Anh Hùng Mệnh Thế" = 英雄命世 = kịch bản Đô Úy (都尉)**. Phát hiện chính: **bản NHẬT (三國志真戦) đang chạy đúng kịch bản này ở S25 ("時代の英雄シナリオ")** — không phải CN-only như nghĩ trước. ⇒ kazten S25 (19/06/2026) là **nguồn phân tích máy-parse-được, 17 編成 都尉 phân T0/T0.5, comp 3 tướng chữ Hán đầy đủ**.
- **Nguồn CHIẾN BÁO BẰNG ẢNH tốt nhất = CN 17173 "都尉战报大赏"** (28/11/2025) — 4 đội kèm **ảnh chụp đối chiến thật** (战报截图). Đây đúng loại "chứng minh bằng ảnh" user yêu cầu.
- **Nguồn VIDEO**: bilibili `BV1P516BNEH9` (CN, ~47k view, nhiều đội) + sangokushi-shinsen.info `#582` (JP S25 都尉 ティアゼロ 魏+呉, có video).
- **KR (삼국지 전략판)**: kịch bản 도위/영웅명세 còn mỏng, tier chủ yếu dạng ảnh forum (dcinside) → chỉ dùng đối chiếu mắt người, không parse.
- **Kết quả ròng: ~10 team MỚI** chưa có trong 31 team hiện tại (chủ yếu nhóm 大喬 + 皇甫宏, 楊琪 五謀, 姜維 蕭芷, 甘寧 慷慨弓) — đều có nguồn proof + URL manual-check bên dưới.

## 1. Nguồn theo server (URL manual-check)

| Server | Nguồn | URL | Loại proof | Parse? |
|---|---|---|---|---|
| **CN** | 17173 都尉战报大赏 | https://news.17173.com/content/11282025/224018547.shtml | ✅ **Ảnh chiến báo** (4 đội) | ✅ fetch OK |
| **CN** | bilibili 心远 都尉阵容推荐 | https://www.bilibili.com/video/BV1P516BNEH9/ | ✅ **Video** thực chiến | video |
| **CN** | zhihu 10 đội đề xuất (mới) | https://zhuanlan.zhihu.com/p/1969722829546166067 | Phân tích | ⚠️ zhihu hay 403 |
| **CN** | zhihu 都尉阵容推荐 | https://zhuanlan.zhihu.com/p/1959647087458252766 | Phân tích | ⚠️ 403 |
| **CN** | 233乐园 001桌实战最强都尉 | https://www.233leyuan.com/post-detail/2063255062787248128 | Phân tích thực chiến | likely ✅ |
| **CN** | 9game tránh hố + cấu hình | https://www.9game.cn/sgzzlb/11552002.html | Phân tích | likely ✅ |
| **JP** | **kazten S25 都尉 編成** | https://kazten.com/entry/2026/06/19/180000 | **Phân tích, 17 編成 T0/T0.5** | ✅ fetch OK |
| **JP** | sangokushi-shinsen.info #582 | https://sangokushi-shinsen.info/2026/05/29/582... | ✅ **Video** S25 都尉 ティアゼロ | likely ✅ |
| **JP** | 三国志真戦攻略 S25 天資 | https://sanngokusinnsenn.com/s25-tenshi-itiran/ | Phân tích nuôi đô úy | likely ✅ |
| **KR** | namuwiki 삼국지 전략판 | https://namu.wiki/w/삼국지%20전략판 | Wiki tier (사조만/사노만…) | ✅ nhưng không bảng 都尉 sạch |
| **KR** | dcinside 중섭 티어표 | https://m.dcinside.com/board/3kingdoms/262051 | Ảnh tier forum | ❌ ảnh |

## 2. Team MỚI cần bổ sung (chưa có trong 31 team)

Tên Việt tạm đặt (giữ convention app, **cần duyệt tay** theo bản game VN — xem `[[vn-game-names-authoritative]]`). Cột Hán để verify.

| # | Tên tạm (VN) | Comp (Hán) | Đô úy | Tier | Phe | Proof / nguồn |
|---|---|---|---|---|---|---|
| 1 | Nhị Kiều Cung | 孫尚香 / 無双大喬 / 皇甫宏 | 皇甫宏 (Hoàng Phủ Hoành) | **T0** | Ngô | kazten JP |
| 2 | Chí Tôn Kiều Cung | 孫権 / 無双大喬 / 皇甫宏 | 皇甫宏 | T0.5 | Ngô | kazten JP |
| 3 | Liêu Kiều Thương | 張遼 / 無双大喬 / 皇甫宏 | 皇甫宏 | T0.5 | Ngụy/hỗn | kazten JP |
| 4 | Khương Duy Tạp Thảo | 諸葛亮 / 姜維 / 蕭芷 | 蕭芷 (Tiêu Chỉ) | T0.5 | Thục | kazten JP (雑草魂) |
| 5 | Dương Kỳ Ngũ Mưu | SP郭嘉 / 楊琪 / 荀攸 | 楊琪 (Dương Kỳ) | T0.5 | Ngụy | kazten JP + zhihu (杨琪五谋弓) |
| 6 | Khảng Khái Cung (Cam Thái Từ) | 甘寧 / 太史慈 / 徐彦 | 徐彦 (Từ Ngạn) | T0.5 | hỗn | **17173 ảnh chiến báo** + kazten (甘太徐) |
| 7 | Tôn Hùng Kỵ | 孫権 / 馬嬋 / 周泰 | 馬嬋 (Mã Thiền) | T0.5 | Ngô | kazten JP (孫熊騎) |
| 8 | Tôn Quyền Tô Tín Chu Thái | 孫権 / 蘇信 / 周泰 | 蘇信 (Tô Tín) | — | Ngô | **17173 ảnh chiến báo** (~1 vạn chiến công/trận) |
| 9 | Mã Thiền Thái Úy Thuẫn | 馬嬋 / 司馬懿 / 曹操 | 馬嬋 | — | Ngụy | **17173 ảnh chiến báo** ("siêu ổn") |
| 10 | Thẩm Hằng Phá Trận (bản Quách Gia) | 沈姮 / 夏侯惇 / 郭嘉 | 沈姮 (Thẩm Hằng) | — | Ngụy | **17173 ảnh chiến báo** (biến thể của team #15 hiện có) |
| 11 | Đông Ngô Cung (Chu Thiệu + SP Lữ Mông) | 周瑜 / 周劭 / SP呂蒙 | SP呂蒙 | T0.5 | Ngô | kazten JP (東呉弓) |

> #10/#8/#9 là **biến thể** của team đã có (Thẩm Hằng Phá Trận, Tôn Quyền cung, Thái Úy thuẫn) nhưng đổi 1 tướng — cân nhắc thêm như variant hoặc ghi chú, không nhất thiết tạo team mới.

## 3. Đối chiếu: team JP/CN ĐÃ KHỚP 31 team hiện có (xác nhận data đúng)

`富貴騎`→Chu Thiệu Ngũ Mưu · `富連騎`→Thẩm Hằng Ngũ Mưu · `法宏盾`→Pháp Quan Hoàng Phủ · `太師弓/拒马弓`→Cự Mã Cung · `女王盾`→Thái Úy Tiêu Chỉ · `周蜀弓`→Chu Thiệu Thục Trí · `西翊弓`→Trần Dực Thục Trí · `妖精盾`→Chu Thiệu Tam Tiên · `温翊/温侯弓`→Ôn Hầu Cung.

⚠️ **Cảnh báo định danh** (theo `[[cn-video-extraction-verify-frames]]`): JP ghi `陳翊` (Trần Dực) cho 温翊弓, nhưng team "Ôn Hầu Cung" của ta dùng **Trần Hy (陈熙)**. CN search cũng có cả `陈熙温侯弓` lẫn `陈翊`. Hai tướng 陈熙 vs 陈翊 dễ nhầm — **verify nội tại/chân dung trước khi gán**, đừng tin tên.

⚠️ Bản Nhật dùng **phồn thể** (滿寵/馬/龐/陳) ≠ heroes-dict giản thể → cần map phồn→giản nếu auto-import.

## 3b. Bổ sung — 12 Đô Úy canonical + 2 team tướng từng thiếu (update 02:3x)

Tổng **12 Đô Úy** (官方 "12都尉"). Map Hán: 陈翼=Trần Dực · 周劭=Chu Thiệu · 苏信=Tô Tín · 柳沁/柳浔=Liễu Tẩm · 萧芷=Tiêu Chỉ · 沈姮=Thẩm Hằng · 陈熙=Trần Hy · 皇甫宏=Hoàng Phủ Hoành · 徐彦=Từ Ngạn · 秦溪=Tần Khê · 马婵=Mã Thiền · 杨琪=Dương Kỳ.

| Team mới | Comp (Hán) | Đô úy | Phe | Proof / nguồn |
|---|---|---|---|---|
| Tần Khê (meta sớm) | 萧芷 / 秦溪 / 陈熙 | 秦溪 (Tần Khê) | Quần/hỗn | 9game + zhihu (萧芷秦溪陈熙 早期天梯) |
| Liễu Tẩm Hoàng Mã | 柳沁 / 皇马... (⚠️ comp chưa đủ) | 柳沁 (Liễu Tẩm) | — | 9game (柳沁皇马) · verify 17173上 |

Nguồn map 12 đô úy + chiến pháp: 17173 "12都尉介绍" [（上）](https://news.17173.com/content/09122025/120907756.shtml) · [（下）](https://news.17173.com/content/09122025/120905270.shtml) · [51nacs 秦溪战法](https://m.51nacs.com/article/1665.html) · [zhihu 天梯](https://zhuanlan.zhihu.com/p/1972787857275000751).

⚠️ Đô úy bản CN dùng tên Hán: 陈熙(Trần Hy) chiến pháp 针锋相对; 徐彦(Từ Ngạn) 缓兵之计 ★★★★★ "công nghệ đen"; 杨琪(Dương Kỳ) 愈战愈勇; 马婵(Mã Thiền) 运筹帷幄.

## 4. Next steps

1. **Ưu tiên thêm 7 team mới "thuần" (#1–7, 11)** vào `do-uy-ss18-source.json` — nhóm 大喬+皇甫宏 (3 đội) và 楊琪 五謀 là meta mới rõ rệt, chưa có trong app.
2. Dịch tên + chiến pháp theo bản VN (duyệt tay), verify tướng 陈熙/陈翊 bằng frame trước khi commit.
3. Lưu URL proof vào field nguồn nếu schema cho phép (hiện schema chưa có field `source`) — cân nhắc thêm `source`/`proof_url` để badge "có chiến báo".
4. CN 17173 是 nguồn ảnh chiến báo công khai → có thể screenshot lưu để minh hoạ tab Đô Úy.

## Unresolved Questions

1. Có muốn **thêm field `source`/`proof_url`** vào `do-uy-ss18-source.json` để gắn link chiến báo cho từng team (hiện chưa có) không?
2. 3 biến thể (#8/#9/#10) — thêm thành team riêng hay chỉ ghi chú variant trong team gốc?
3. Tên Việt cho 大喬(Đại Kiều)/楊琪(Dương Kỳ)/沈姮(Thẩm Hằng?)/苏信(Tô Tín?) — chốt theo bản game VN nào? Cần bạn xác nhận để khỏi sai Hán-Việt.
