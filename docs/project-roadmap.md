# Roadmap dự án

## Tổng quan

Roadmap ưu tiên duy trì dữ liệu đúng và vận hành an toàn trước khi thêm feature. Trạng thái bên dưới là định hướng evergreen từ repo hiện tại, không thay đổi hoặc diễn giải lại status của các plan lịch sử trong `plans/`.

## Ưu tiên 1 — Tái lập dữ liệu

- [ ] Hợp nhất nguồn/augmentation đã tạo 56 Team PK và 48 Đô Úy vào pipeline nhìn thấy, có test fixture rõ.
- [ ] Quyết định vai trò `pipeline/do-uy-ss18-source.json` (40 mục) và thêm consumer hoặc loại bỏ có chủ đích.
- [ ] Cập nhật expected count trong `build_json.py` chỉ sau khi đường nguồn đã đầy đủ; không sửa số đơn lẻ.
- [ ] Rebuild `facets.json` từ đúng 214 team; thêm test phát hiện lệch tổng source/status.
- [ ] Tài liệu hóa artifact nguồn cần thiết cho clean clone hoặc cung cấp source snapshot hợp lệ.
- [ ] Xác định chiến lược cache crawl: checkpoint có checksum, export được phép commit, hoặc quy trình recrawl có kiểm soát.
- [ ] Review 27 chiến pháp pending trong `tactics.json`; giữ provenance cho mỗi bổ sung.

Tiêu chí hoàn thành: một checkout có các prerequisite đã mô tả có thể build lại artifact hiện tại theo deterministic diff và full test pass.

## Ưu tiên 2 — Accessibility và UX

- [ ] Bổ sung semantics `tablist`/`tab`/`tabpanel` và điều hướng bàn phím cho section tabs.
- [ ] Quản lý focus khi mở/đóng modal tướng và các dialog tương lai; hỗ trợ Escape và trả focus.
- [ ] Cho drop-zone ảnh focus/activate bằng bàn phím, không chỉ click/drop/paste.
- [ ] Dùng live region cho trạng thái nén/upload/analyze và lỗi async.
- [ ] Kiểm tra touch target, contrast và focus-visible của chip, clear, collapse, theme/menu.
- [ ] Thêm test accessibility hẹp cho các contract tương tác trên.

## Ưu tiên 3 — Privacy và security vận hành

- [ ] Làm rõ retention/policy DashScope trong UI và deployment checklist; giữ cảnh báo crop tên tài khoản.
- [ ] Kiểm tra định kỳ `ALLOWED_ORIGIN`, Turnstile site/secret pair, model ID và endpoint theo production.
- [ ] Đặt budget/backstop ở provider; xem KV caps là cảnh báo best-effort, không guarantee.
- [ ] Đánh giá Durable Object nếu quota tháng phải cứng/atomic.
- [ ] Xoay API key theo lịch; xác nhận không log payload ảnh trong Worker/provider settings.
- [ ] Thiết lập smoke test production không chứa dữ liệu cá nhân.

## Bảo trì liên tục

- Chạy test hẹp sau thay đổi, full Python/JS/Worker/typecheck trước deploy.
- Curate aliases, nickname, tactic override, books map và team tier từ nguồn kiểm chứng.
- Review toàn bộ diff `data/*.json`; không chấp nhận count-only mà bỏ qua schema/provenance.
- Giữ docs đồng bộ khi command, runtime behavior, deploy boundary hoặc threat model đổi.
- Theo dõi dependency dev của Worker; không thêm dependency frontend/pipeline nếu stdlib/platform đủ dùng.
- Backup/export local tracker trước thay đổi schema; cung cấp migration nếu bump schema version.

## Mở rộng sau khi nền tảng ổn định

- Cải thiện giải thích scoring/diagnostics của recommender cho người dùng.
- Thêm preset cùng tồn dạng dữ liệu có schema nếu cần dùng trực tiếp trong engine.
- Hỗ trợ provider Vision khác sau khi tách contract model và có regression fixture.
- Thêm observability tổng hợp không chứa ảnh, tên account hoặc model raw output.

## Nguyên tắc quyết định

- Không mở rộng kiến trúc khi có thể giải quyết bằng dữ liệu/config/helper hiện có.
- Không để AI quyết portfolio; model chỉ đọc ảnh, engine local giữ quyền quyết định.
- Không đánh đổi privacy, accessibility, data-loss safeguard hoặc error handling để giảm scope.
- Kế hoạch trong `plans/` là tài liệu lịch sử; code, tests, config và artifact commit là nguồn kiểm chứng hiện tại.

## Bước tiếp theo

Việc đầu tiên: thiết kế đường nhập 48 Đô Úy/56 Team PK vào pipeline có test, rồi sửa facet drift trong cùng contract dữ liệu.

## Tham chiếu

- [PDR](project-overview-pdr.md)
- [Codebase Summary](codebase-summary.md)
- [Deployment Guide](deployment-guide.md)
- [Design Guidelines](design-guidelines.md)
