# Phase F — 3–5 bài hướng dẫn vi+ja dạng nháp

Branch: `feat/ja-locale-f-articles`. Phụ thuộc: B (tên Nhật, mềm). Chạy song song với mọi phase. Effort 10h. Rủi ro: thấp. Không publish (ngoài phạm vi); không chép mô tả tiếng Nhật của bên thứ ba.

## Bối cảnh

- Blog lấy bài từ `community-worker` (`GET /api/posts`) lúc build (`src/lib/blog-posts.ts:1-5`); bài ghép bản dịch qua `translationKey` duy nhất theo `(lang, translation_key)` (`community-worker/migrations/0002_community.sql:72`). D1 hiện chỉ nhận `lang in ('vi','zh')` (`0002_community.sql:56`), nên bản ja chỉ dán được vào `/quan-tri/` sau phase G.
- Mẫu bản nháp: `plans/261117-0127-huong-dan-mua-pk-s27/bai-viet-huong-dan-mua-pk-s27.md` ở checkout chính `/Users/plateau/Project/CamNangTQCCL` (bảng trường Tiêu đề/Slug/Mô tả/Tag/Ngôn ngữ, rồi "Thân bài (dán vào ô Markdown)", link nội bộ dạng đường dẫn site, ghi rõ nguồn và mức xác nhận).
- Quy ước tên: bài vi giữ tên tướng/chiến pháp theo bản game VN (bộ nhớ dự án "VN game names authoritative"); bài ja dùng tên trong `data/lookup-ja.json` (B), tên `derived` có thể ghi kèm tên gốc khi cần. Thuật ngữ theo `pipeline/ja-glossary.json`.
- Nguồn Nhật đã có: Kazten (đội mẫu S26/S27, khai hoang, kịch bản 兵演春秋), báo cáo `plans/reports/research-261116-kazten-s27-sp-tao-thao-counter-video.md`, `research-261015-japanese-content-sources.md` (checkout chính).

## Sở hữu

`plans/261117-0153-ja-locale/articles/NN-<slug>.vi.md`, `plans/261117-0153-ja-locale/articles/NN-<slug>.ja.md`, `plans/261117-0153-ja-locale/articles/README.md` (mục lục + trạng thái + nguồn).

## Đề xuất chủ đề (chốt 3–5 khi bắt đầu, theo nguồn đọc được)

1. Đội mạnh mùa Hán Diễm Trường Minh theo đánh giá phía Nhật (tóm tắt có nguồn, link sang `/doi-chuan/` và facet nguồn JP sau E2).
2. Khắc chế SP Tào Tháo phe Hán (dựa báo cáo Kazten S27 đã có).
3. Khai hoang đầu mùa theo cách người chơi Nhật mở đất (link `/khai-hoang/`; bộ nhớ dự án yêu cầu nội dung quảng bá mùa mới nhấn Khai hoang).
4. Bảng thuật ngữ Nhật ↔ Việt cho người chơi (凸, 兵法書, 覚醒, ポイント振り, tên alias đội như 富貴騎, 法官盾).
5. Kịch bản 兵演春秋 ở bản Nhật khác gì bản Việt (tuỳ nguồn).

## Bước

1. Đọc nguồn, ghi danh sách dữ kiện + URL + ngày cho từng bài trong `articles/README.md`.
2. Viết bản vi trước (giọng, cấu trúc như mẫu), rồi bản ja **viết từ dữ kiện nguồn**, không dịch máy từ bản vi (issue #10: dịch tiếp từ bản Việt dễ sai nghĩa). Mỗi cặp dùng chung `translationKey`; slug ja trùng slug vi để khớp ràng buộc "cùng slug".
3. Mỗi bài ghi mục nào chưa xác nhận, số liệu theo bản nào, và khác biệt tên giữa bản Nhật/Việt.
4. Reviewer độc lập soát: không chép nguyên văn nguồn, tên VN đúng game VN, tên Nhật khớp `data/lookup-ja.json`, link nội bộ là đường dẫn có thật (bản ja dùng `/ja/...`).

## Cách kiểm

Danh sách kiểm trong `articles/README.md` cho từng bài: bảng trường đủ, `translationKey` khớp cặp, link nội bộ có trong sitemap build gần nhất, nguồn có URL + ngày, reviewer ký nhận.

## Rủi ro

| Rủi ro | Khả năng × Tác động | Giảm thiểu |
|---|---|---|
| Chép nguyên văn nguồn Nhật | Thấp × Trung bình | Chỉ lấy dữ kiện, viết lại; reviewer soát |
| Tên Nhật lệch dữ liệu site | Trung bình × Thấp | Đối chiếu `data/lookup-ja.json` |
| Không dán được bản ja vì D1 | Chắc chắn nếu không có G × Thấp | Ghi rõ trong `articles/README.md`; G mở khóa |

## Rollback

Xoá thư mục `articles/` (không ảnh hưởng runtime).

## Done khi

3–5 cặp bài vi+ja nháp hoàn chỉnh trong `articles/`, có nguồn, đã qua soát độc lập, không publish.
