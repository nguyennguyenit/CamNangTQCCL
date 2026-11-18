# Bài hướng dẫn nháp vi + ja (phase F)

Bốn cặp bài Markdown nháp, mỗi cặp có bản tiếng Việt (`vi.md`) và tiếng Nhật (`ja.md`). Không publish. Mỗi bản ja được viết từ dữ kiện nguồn Nhật, không dịch từ bản vi.

## Danh sách bài

| Thư mục (= slug) | translationKey | Chủ đề | Nguồn chính | Soát độc lập |
|---|---|---|---|---|
| `meta-pk-s26-goc-nhin-nguoi-choi-nhat` | `meta-pk-s26-jp-view` | 24 đội T0/T0.5 PK-S26 của Kazten, điểm chung | Kazten 19/06/2026 | chưa |
| `chuan-bi-phe-han-qua-server-thu-nghiem-nhat-ban` | `han-faction-jp-trial-server` | Phe Hán và 20 cấu hình server thử nghiệm Nhật S27 (dữ liệu thử nghiệm, server chính Nhật mở 21/11/2026) | Chousen #670, Kazten 桃園結義, Shinsen Navi 漢室弓 | chưa |
| `doi-chieu-ten-chien-phap-nhat-trung-viet` | `tactic-names-ja-zh-vi` | Vì sao tên chiến pháp khác nhau, bảng 18 chiến pháp | Shinsen Navi, sanngokusinnsenn.com | chưa |
| `thuat-ngu-cong-dong-nhat-ban` | `jp-community-glossary` | 凸, 兵法書, 覚醒, ポイント振り, cách đặt tên đội | Kazten | chưa |

Bài 2 không trùng bài `plans/261117-0127-huong-dan-mua-pk-s27/bai-viet-huong-dan-mua-pk-s27.md` (ở checkout chính): bài kia nói luật mùa, bài này chỉ nói đội hình thấy trên server thử nghiệm Nhật.

Tiếng Việt và tiếng Nhật trong cùng một cặp dùng chung slug và translationKey, để khớp ràng buộc "cùng slug" và ghép bản dịch (`src/lib/blog-posts.ts`).

## Cấu trúc mỗi tệp

1. Bảng trường: Tiêu đề, Slug, Mô tả, Tag, Ngôn ngữ, translationKey.
2. `## Thân bài`: dán vào ô Markdown.
3. `## FAQ`: ba cặp hỏi đáp, nhập vào mục Câu hỏi thường gặp.
4. `## Ghi chú cho người duyệt`: chỉ để duyệt, **không dán**.

## Nhập vào `/quan-tri/`

1. Vào `/quan-tri/` → Bài viết → Tạo bài.
2. Điền Tiêu đề, Slug, Mô tả, Tag đúng theo bảng trường. Chọn Ngôn ngữ. Điền Khoá bản dịch bằng `translationKey` của cặp.
3. Dán phần "Thân bài" vào ô Markdown. Phần FAQ nhập thành từng cặp ở mục Câu hỏi thường gặp.
4. Bấm **Lưu nháp**. Chỉ xuất bản sau khi đã soát (mục "Danh sách kiểm" bên dưới).
5. Nhập bản vi trước, rồi bản ja với cùng slug và translationKey.

Lưu ý riêng cho bản ja:

- **Bản ja chỉ lưu được sau khi chủ repo đã áp migration D1 cho `ja` (phase G) và deploy `community-worker`.** Hiện D1 chỉ nhận `lang in ('vi','zh')` (`community-worker/migrations/0002_community.sql`), nên lưu `ja` trước đó sẽ lỗi 400.
- Ô chọn Ngôn ngữ trong `/quan-tri/` có lựa chọn `ja` sau khi phase A và C ghép vào. Trước đó chỉ chọn được vi và zh.
- Khối "Trong cẩm nang" cuối bài chọn mục theo tag (`src/lib/blog-guide-link.ts`). Cả bốn bài cố ý không dùng tag `khai hoang` hay `kho`, nên khối này dẫn sang Đội chuẩn.
- Các link `/ja/...` trong bản ja trỏ tới trang chỉ có sau khi phase C ghép. Bản vi tương ứng đã có trong site hiện tại.

## Link nội bộ

Mọi link nội bộ dùng đường dẫn của site, không dùng URL tuyệt đối. Đã kiểm bằng `pipeline/lookup-route-handles.json` (slug Tra cứu), dữ liệu mùa (`/doi-chuan/pk-s26/`) và cây `src/pages/` (`/khai-hoang/`, `/doi-chuan/`, `/goi-y-doi-tu-kho/`, `/tra-cuu/`, `/tra-cuu/binh-thu/`). Link `/ja/...` coi là hợp lệ khi bản vi tương ứng tồn tại.

`/doi-chuan/pk-s27/` bị cố ý không dùng: PK-S27 là mùa mặc định nên slug này chuyển 301 về `/doi-chuan/`.

Không bài nào link sang bài khác trong loạt, vì các bài chưa publish và chưa có route.

## Nguồn và ngày đọc

Mọi nguồn đọc ngày 2026-11-17. Chi tiết, điều khoản và rủi ro bản quyền ở `plans/reports/researcher-261117-0153-jp-tier-sources.md` và `researcher-261117-0153-ja-name-sources.md`. Không dùng ảnh của nguồn, không dùng Hensei Kobo. Bài chỉ lấy dữ kiện (tên, xếp hạng, thành phần đội) và viết lại bằng lời riêng.

| Nguồn | Dùng cho |
|---|---|
| [Kazten, 19/06/2026](https://kazten.com/entry/2026/06/19/180000) | 24 đội PK-S26 (bài 1, 4) |
| [Kazten, 09/09/2026](https://kazten.com/entry/2026/09/09/195242) | Cách trình bày bài đội mẫu (bài 4) |
| [Kazten, 桃園結義 08/11/2026](https://kazten.com/entry/2026/11/08/190000) | Đội phe Hán (bài 2) |
| Chousen #670 (xem URL đầy đủ trong bài 2) | 20 cấu hình server thử nghiệm S27 (bài 2) |
| [Shinsen Navi 漢室弓](https://sangokushi-shinsen.com/kanshitukyu/) | Mẫu 漢室弓 (bài 2) |
| [Shinsen Navi lịch mùa](https://sangokushi-shinsen.com/season/), [Dengeki 92942](https://dengekionline.com/article/202611/92942) | Ánh xạ mùa JP và VN (bài 1, 2) |
| `plans/reports/ja-names-observed-261117.json` | Tên Nhật của chiến pháp và tướng (bài 1, 2, 3) |

## Danh sách kiểm (reviewer ký nhận)

Đánh dấu sau khi soát từng bài. Các mục đầu đã được người viết tự kiểm; mục "Soát độc lập" để trống cho reviewer.

- [ ] Bảng trường đủ sáu mục, `translationKey` giống nhau trong cặp, slug giống nhau.
- [ ] Mô tả không quá 500 ký tự, tiêu đề không quá 200, tag không quá 50 ký tự mỗi tag.
- [ ] Tên tướng, chiến pháp bản vi đúng tên game Việt Nam (`data/heroes-dict.json`, `data/tactics.json`).
- [ ] Tên Nhật khớp `plans/reports/ja-names-observed-261117.json`, và sau phase B thì khớp `data/lookup-ja.json`.
- [ ] Không chép nguyên văn hay dịch nguyên đoạn từ nguồn Nhật; không dùng ảnh nguồn.
- [ ] Link nội bộ có route thật (bản ja dùng `/ja/...`).
- [ ] Mỗi bài có mục nguồn kèm link và ghi rõ phần chưa chắc chắn.
- [ ] Soát độc lập (tên: ........, ngày: ........).

Các bài có chỗ cần người chơi bản Nhật xác nhận trước khi publish: bài 4 (nghĩa của 凸 và ポイント振り), bài 3 (câu nói trang `/ja/` hiển thị tên Nhật chỉ đúng sau phase C).

## Rollback

Xoá thư mục `articles/`. Không ảnh hưởng runtime.
