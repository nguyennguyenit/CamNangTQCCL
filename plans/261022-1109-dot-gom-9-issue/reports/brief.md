# Brief (đã chốt qua ak:advise, Fable + Astra review)

Objective: Xử lý 9 issue mở (#5 #6 #12 #14 #15 #16 #20 #21 #23), mỗi nhóm một PR; Research MCP và D1+community-worker mỗi thứ release một lần, Pages release chính thức một lần ở cuối đợt.

Done means: 9 issue đóng kèm link PR; mọi commit trên main deploy được lên production (blog vẫn tự deploy Pages); #12 = pre-push hook + CI chỉ trên pull_request + schedule hằng tuần, README hướng dẫn core.hooksPath; #14 = 68 id binh thư hiện tại đóng băng qua ánh xạ chinese → id mà generator giữ nguyên, không chỗ nào còn suy id từ tên Việt, test đổi tên đi qua lookup/Soi đội/lịch sử/link ?doi=/season validation/MCP, LEDGER_NOTE + docs/unified-lookup.md + docs/system-architecture.md đã sửa; #15 = route entity theo lookupHref (trang riêng nếu có, specials dùng ?id=), builder đọc bảng ngoại lệ slug của ledger, release theo docs/mcp-research-server.md; #16 = docs/zh-gaps.md, --check trong npm run verify; #6 = trang mùa vi+zh cho Đội chuẩn và Đội khác, có trong sitemap, verify-astro-dist, canonical/hreflang, redirect ?season= cũ, tên mùa trong H1 trang chi tiết đội (title/JSON-LD đã có), nhãn "mùa cũ"; #5 #20 #21 #23 đủ phạm vi issue theo plans/261021-0632-dong-bo-kho-va-doi-cua-toi/plan.md; D1 0011 + community-worker deploy một lần sau khi duyệt schema #21/#23, chạy test community-worker, thử migration và kiểm production bằng đăng nhập Google thật; cuối đợt chạy gate (kiểm head SHA) → MCP → Pages, main không đổi tới khi cả hai xong.

Out of scope: #10; redirect binh thư (#14B); mọi tính năng ngoài nội dung issue.

Constraints: Hàng nối tiếp #14 → #5 → #20 → #6 → #21 → #23 (file bị ghim bản dịch trong pipeline/site-localization-policy.json, mỗi PR chạy lại chuỗi "Publish lại bản dịch hiển thị" docs/deployment-guide.md); #12 #16 làm song song được; #15 làm song song nhưng merge từng PR một và sinh lại mcp-worker/src/generated/workflow-build.ts trên code đã gộp; không đổi slug hoặc id hiện có; client gọi /api/roster chỉ vào main sau khi worker đã chạy trên production; rollback phải revert cả main lẫn Pages, giữ bảng D1.

Stop and ask only if: chạy migration D1 hoặc release production; duyệt schema #21/#23; lỗi không giải thích được; thay đổi ngoài 9 issue; cần force-push main hoặc xóa dữ liệu.

## Quyết định đã chốt
- #12: A' + giữ CI trên PR (bỏ trigger push, giữ pull_request, thêm schedule hằng tuần; job credential-free không dùng secret).
- #14: chỉ A (đóng băng id), không redirect binh thư.
- #16: --check trong npm run verify.
- Blog đăng bình thường trong đợt → invariant: main luôn deploy được.
- #10 ngoài đợt. PR #26 chỉ sửa css/styles.css + tests-e2e/responsive.spec.mjs, không phải prerequisite.

## Đã kiểm trên production (2026-10-22)
- #6: JSON-LD đội đã có (WebPage + BreadcrumbList + isPartOf VideoGame), title có mã mùa "(OG)", H1 không có mùa; không có nhãn "mùa cũ"; llms.txt đã có /llms/tra-cuu/*; /bai-viet/test/ 404; /doi-chuan/ chỉ còn chữ "cần JavaScript" trong comment HTML footer. Chưa có /doi-chuan/mua/.
