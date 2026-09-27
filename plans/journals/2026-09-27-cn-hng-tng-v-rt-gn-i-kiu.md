---
title: Căn hàng tướng và rút gọn Đại Kiều
date: 2026-09-27
summary: "Bỏ nhãn Binh thư, rút gọn tên hiển thị CO Đại Kiều, cố định cột tên để chiến pháp và binh thư thẳng hàng."
---

# Căn hàng tướng và rút gọn Đại Kiều

## What happened
Thẻ Đội chuẩn đã mất căn hàng sau khi cột tên đổi từ 8rem sang max-content: mỗi hàng có điểm bắt đầu chiến pháp khác nhau. Nhãn Binh thư vẫn được ghép trong renderer, còn dữ liệu hiển thị dùng CO Vô Song Đại Kiều.

## Decision
Renderer chỉ rút gọn tên Đại Kiều trên giao diện tiếng Việt; tên nguồn và danh tính cấu hình được giữ nguyên. Cột tên rộng 176px, đủ cho 118 tên hiện có. Bỏ nhãn Binh thư khỏi thẻ và cập nhật inventory bản địa hóa giảm một vị trí.

## Verification
Kiểm tra trực tiếp /doi-chuan/ tại 320, 390, 480, 512, 520, 600, 744 và 1280px: tên không xuống dòng, không tràn ngang, cột chiến pháp thẳng hàng. Trang chi tiết và chế độ Bảng cùng hiện CO Đại Kiều. 11 test Node, Astro check, design token check và diff check đạt.

## Next steps
npm run check vẫn chặn vì source hash cũ của Landing.astro, SiteLayout.astro và seal.ts từ thay đổi đang có trong working tree; cần review riêng các tệp đó trước khi cập nhật hash.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
