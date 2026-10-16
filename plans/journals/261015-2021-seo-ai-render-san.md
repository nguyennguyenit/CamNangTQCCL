# SEO cho AI crawler: dựng sẵn đội + Tra cứu, 1772 trang mục, JSON-LD, llms-full

Kế hoạch `plans/261015-1658-seo-ai-render-san` (issue #6, #7). Chưa commit, chưa deploy.

## Việc đã làm
- Phase 1: builder đội (Đội chuẩn/Đội khác/Cùng Tồn/Khai hoang, thẻ/bảng/chi tiết) trả cây view, chạy trong Node không `document`; `withLocale` trong `js/i18n.js`. Đối chiếu DOM trước/sau 42/42 file giống hệt.
- Phase 2: `src/lib/team-ssr.ts` dựng sẵn danh sách + chi tiết đội từ publication đã pin. Quy tắc nhận lại DOM: thân dựng sẵn mang `data-ssr-signature`; client chỉ nhận node và gắn sự kiện khi dấu khớp trạng thái đầu, lệch thì dựng lại. Nút chưa gắn sự kiện để `disabled` trong HTML.
- Phase 3: 7 trang nhóm Tra cứu dựng sẵn đủ 886 mục (ẩn bằng `html[data-lookup-js] [data-lookup-later]` khi có JS); hồ sơ thành cây view; 886 × 2 = 1772 trang riêng `/tra-cuu/<nhóm>/<slug>/`, title/description không trùng. Ledger slug `pipeline/lookup-route-handles.json` đóng băng (`handlesSha256`), thêm `retired`: mã biến mất vẫn giữ chỗ slug, mã quay lại nhận lại slug cũ.
- Phase 4: trang đội hết link `?id=`; JSON-LD trên trang đội, trang nhóm (`CollectionPage` + `ItemList`) và trang mục; `/llms.txt` + 30 file con (Đội chuẩn tách theo mùa vì tổng 1,18 MB) + `/llms-full.txt` 2.668.288 B sinh từ cùng một hàm `llmsDocuments`; `reports/zh-gaps.md`: 570/886 mục thiếu mô tả zh.

## Bất ngờ và cái giá
- **Localization phải republish cả chuỗi sau mỗi lần sửa file trong `policy.sourceFiles`**: `build --stage all` → `check --candidate` → `publish` → `check --stage public` → `prune`, rồi re-pin `pipeline/team-route-handles.json`. Hash nguồn nằm trong publication, nên sửa một comment ở `SiteLayout.astro` cũng ra generation Recommended mới. Cả chương trình đi qua `a973b093…` → … → `d7d15ecd…`. Tốn thời gian và dễ quên; quên thì `check --stage public` chặn build.
- **Hằng dịch ở cấp module khoá locale lúc build**: `LABELS`, `LOOKUP_EMPTY`, `POSITION_LABELS`… tính một lần lúc import, nên build zh chung tiến trình với vi ra nhãn tiếng Việt. Đã đổi hết thành hàm. Mẫu này vô hại trong trình duyệt (mỗi trang một locale) và chỉ lộ ra khi SSR.
- **Lỗi CSS do chính mình gây**: quy tắc ẩn `.lookup-more-row` khi không JS trúng luôn hàng "Xem thêm" của Đội chuẩn/Đội khác vì hai nơi dùng chung class, làm 4 ca `recommended-browser` fail. Đã giới hạn trong `#section-lookup`. Class dùng chung không bao giờ là chỗ an toàn cho selector toàn cục.
- **JSON-LD sai schema**: bản đầu đặt `inLanguage`/`isPartOf`/`url` trên `Thing`/`DefinedTerm`, trong khi các thuộc tính này chỉ thuộc `CreativeWork`. FinalReview bắt được. Đã sửa thành `ItemPage` + `mainEntity`; test dist khẳng định `mainEntity` không mang các trường đó. Tên trong JSON-LD còn lệch với chữ hiển thị (`CO Vô Song Đại Kiều` so với `CO Đại Kiều`), đã sửa bằng `holderDisplayName`.
- **Cổng e2e 4174 đụng worktree khác** (dùng chung máy, chung `dist/`): chạy bằng `playwright.local.config.mjs` trên 4184. Lần build cuối là lần duy nhất được ghi `dist/`.

## Quyết định
- Slug suy từ hậu tố mã; trang chỉ nhúng ngoại lệ (`{}`, 2 byte) thay cho bảng 36 KB. Trang riêng chỉ nạp 12,6 KB JS (trước là ~277 KB), có test giữ trần.
- Verifier và sitemap lấy số liệu từ ledger/corpus, không viết số tay; test zh-gaps chỉ kiểm bất biến, không đọc file trong thư mục kế hoạch.

## Xác minh (cây cuối)
`npm run build` 4917 trang, sitemap 4912 URL; `verify` OK; `test:dist` 49/49; `test:node` 545/545; `python3 -m unittest` 426 OK; `astro check` 0 lỗi; e2e 481 passed + 1 flaky ngoài phạm vi (`beta-tools.spec.mjs:856` Turnstile, chạy lại `--repeat-each=3` 6/6).

## Còn lại
- Commit + deploy: chưa được cho phép trong phiên.
- Khai hoang: sau Back, thẻ hiện cấu hình mặc định một nhịp rồi `restoreReturnState` mới áp lựa chọn đã lưu.
- 570/886 mục thiếu dữ liệu zh (quân sư/cải tạo/công trình thiếu toàn bộ); bổ sung dữ liệu ngoài phạm vi.
