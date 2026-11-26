# Code review: Bỏ `?from=` khỏi link nội bộ tới trang chi tiết đội

Nhánh `fix/clean-team-detail-links`, thay đổi chưa commit, review ngày 2026-11-25 (Asia/Saigon). Chỉ đọc, không sửa code.

## Phạm vi

- File: `js/team-detail-navigation.js`, `js/team-detail.js`, `js/khaihoang-detail.js`, `js/app.js`, `js/legacy-routes.js`, `js/lookup-profile.js`, `js/lookup-tactic-profile.js`, `js/site-chrome.js`, `js/team-filter-section.js`, `src/lib/team-section-ssr.js`, `src/lib/host-bridge.ts`, `src/components/pages/KhaiHoangDetail.astro`, `scripts/verify-astro-dist.mjs`, `public/_headers`, `pipeline/*.json`, `data/website-display.json`, test trong `tests-js/` và `tests-e2e/` (gồm `team-detail-return.spec.mjs`, `site-chrome.test.mjs` mới).
- Đối chiếu: `plans/261119-1809-bo-from-link-noi-bo/plan.md` + 3 phase, mục đầu `docs/project-changelog.md`.
- Không chạy lại test/build (caller đã xác nhận xanh). Đã chạy một probe Node trên `resolveDetailReturn` (scratchpad) và `curl -I` header production.

## Đánh giá chung

Phần lõi chắc chắn. `safeReturnUrl` luôn dựng lại đích từ pathname trong allowlist cộng các khóa được phép, nên không có đường open redirect. `origin` lấy từ `location.origin`. Storage hỏng hay bị chặn đều được xử lý. `replaceState` chỉ gỡ `from`. Chữ ký SSR bỏ URL là đúng vì danh sách không đọc `scenario`/`ruleset`/`config`. Không còn caller nào phát `from`. Còn một lỗi đích Quay lại thật ở bước fallback sessionStorage (Medium) và một rủi ro UX nhỏ ở bước hoãn khôi phục (Low).

## Critical

Không có.

## High

Không có.

## Medium

### M1. Referrer cùng origin nhưng không phải trang mục vẫn rơi xuống sessionStorage, nên Quay lại dùng đích cũ

- Vị trí: `js/team-detail-navigation.js:382-385` (`resolveDetailReturn`, bước 3 sang bước 4).
- Nguyên nhân: `safe(referrer)` trả `null` cho mọi referrer cùng origin không thuộc `SECTION_QUERY_KEYS`. Code coi đó là "referrer vô dụng" và đọc sessionStorage. Các trang dẫn tới trang chi tiết nhưng không nằm trong allowlist:
  - trang riêng Tra cứu `/tra-cuu/<nhóm>/<slug>/` (khối "Đội tiêu biểu" của `profilePageTree`);
  - trang mùa `/doi-chuan/<mùa>/`;
  - Landing `/`;
  - `/doi-cua-toi/`;
  - bài viết blog;
  - trang chi tiết khác (link "Xem đội gốc").
- Tình huống lỗi, đã tái hiện bằng probe:
  1. Trong cùng tab, người dùng mở đội T từ `/doi-chuan/?q=cu&kho=thieu-2`.
  2. Sau đó họ vào `/tra-cuu/tuong/luu-bi/` rồi bấm T trong "Đội tiêu biểu".
  3. Nút Quay lại trỏ `/doi-chuan/?q=cu&kho=thieu-2`, tức danh sách cũ còn bộ lọc kho. Đích này lại được ghim vào `history.state` và ghi lại vào storage, nên lỗi tự kéo dài.
  4. Probe cho cùng kết quả với referrer `/doi-chuan/pk-s26/`, `/`, `/doi-cua-toi/`, `/bai-viet/x/` và `/doi-chuan/pk-s27-other/`.
- Trước thay đổi: các nguồn này không có `from` hợp lệ nên nút về link họ đội mặc định. Đây là hồi quy. Nó cũng trái với quyết định thiết kế của plan: "Referrer đứng TRƯỚC storage để mở lại cùng đội từ danh sách khác không lấy đích cũ".
- Mức độ: Medium. Đích vẫn an toàn nhưng sai ngữ cảnh, và xảy ra trong luồng phổ biến Tra cứu → Đội tiêu biểu.
- Hướng sửa: chỉ đọc storage khi referrer rỗng, không parse được, khác origin, hoặc cùng origin mà `stripLocale(pathname)` trùng `slot.key` của chính trang chi tiết. Nhóm này phủ đổi ngôn ngữ, đổi `?variant=` bằng link, nút "Xem cấu hình mặc định", reload/skip-link và OAuth. Referrer cùng origin khác trả `null` để caller giữ link họ đội. Ví dụ:

```js
const opened = safe(referrer);
if (opened) return withKhaiHoangPair(opened, khaiHoang);
const slot = detailReturnSlot(href);
if (!slot || !storageFallbackAllowed(referrer, slot.key, origin)) return null;
// storageFallbackAllowed: referrer rỗng/hỏng/khác origin, hoặc stripLocale(new URL(referrer).pathname) === slot.key
```

- Thêm unit test cho từng referrer ở trên (kỳ vọng `null`) và một ca E2E: trang riêng Tra cứu → Đội tiêu biểu sau khi đã mở cùng đội từ danh sách lọc.

## Low

### L1. Hoãn khôi phục vị trí khi URL có `kho`/`xep` không có trần thời gian và không bị hủy khi người dùng cuộn hay tương tác

- Vị trí: `js/app.js:458` (`afterRoster = restoreView`), `js/app.js:560-585` (`rosterSettled` chỉ chạy khi `loadSession` và hai từ điển xong).
- Tình huống: người dùng có phiên (có hint) quay về `/doi-chuan/?kho=…`. Bước mở thẻ và cuộn phải chờ `/api/me` và tải `heroes-dict.json` + `tactics.json`. `api()` không có timeout hay signal, nên trên mạng chậm khối này có thể chạy sau vài giây. Lúc đó trang nhảy vị trí và lấy focus trong khi người dùng đã tự cuộn hoặc mở `details`. Chỉ `navigateReference` (đổi bộ lọc) hủy được việc hoãn. Nếu `/api/me` treo thì khối này không bao giờ chạy.
- Hướng sửa: hủy `afterRoster` khi có `scroll`/`pointerdown`/`keydown` của người dùng, hoặc đặt trần (ví dụ 1,5 s) rồi khôi phục trên danh sách hiện có. `setRoster` đã tự áp lại disclosure khi danh sách đổi (`js/team-filter-section.js:639-641`).

## Đã kiểm, không phải lỗi

- **Open redirect / URL độc:**
  - Đầu ra luôn là `localePath(sectionPath) + khóa allowlist` đã encode bằng `URLSearchParams`.
  - URL tuyệt đối phải bắt đầu bằng `${location.origin}/`. Bị chặn: `//`, `\`, ký tự điều khiển, `javascript:`/`data:`, giả domain `tqccl.com.evil`, `tqccl.com@evil`, khác scheme/cổng.
  - `%2e%2e`/`%2F` bị loại nhờ so pathname đã giải mã với pathname thô.
  - Giá trị storage độc kèm tiền tố `/zh` hay `/ja` cũng bị loại.
  - Test `HOSTILE_RETURNS` phủ từng vị trí nguồn.
- **Thứ tự nguồn:** state → `from` → referrer → storage → `null`, đúng như mô tả. Không có đường nào để một entry vừa có `teamDetailReturn` cũ vừa có `?from=` mới (`location.replace` hay entry mới đều làm state rỗng). Forward về entry chi tiết đã ghim vẫn dùng đích lúc ghim; đây là ngữ nghĩa có chủ đích, không coi là lỗi.
- **sessionStorage:**
  - `sessionStore()` bắt lỗi truy cập. `storage` null hay `getItem`/`setItem` ném đều được bắt; JSON hỏng thì coi như rỗng; quota được bắt.
  - Tối đa 32 mục. Khóa bắt đầu bằng `/` nên `Object.fromEntries` giữ đúng thứ tự chèn.
- **`history.replaceState`:**
  - `detailUrlWithoutReturn` chỉ gỡ `from`, giữ `variant` và hash. Không có `from` thì không đổi URL.
  - `selectVariant`/`reportVariantFailure` giữ `history.state`.
  - `community-auth.js` cũng giữ state.
- **Khai hoang:**
  - Ghi đè cặp chỉ áp cho đích lấy từ referrer.
  - `teamId` lấy từ `data-khaihoang-team-id`.
  - `knownVariant` đối chiếu chip dựng sẵn (chip mặc định `data-variant=""` bị loại bằng `!!variantId`).
  - Đội không routable thì bỏ cả cặp.
  - `?from=` cũ giữ nguyên cặp của nó.
- **Chữ ký SSR:**
  - `projectRecommendedRows` không đọc `scenario`/`ruleset`/`config`; `source` nằm trong `filters`.
  - `notices` vẽ ngoài `.reference-view` (`team-filter-section.js:614`).
  - `rosterOrdered` vẫn chặn nhận lại DOM dựng sẵn khi đã có độ phủ.
  - Miễn `kho`/`xep` khỏi stale guard không tạo nháy mới so với trước, vì trước đây guard cũng bị gỡ trước khi kho tải xong.
- **Caller sót `from`:** grep `js/`, `src/`, `scripts/`, `mcp-worker/src`, `worker/src`, `community-worker/src` không còn chỗ nào phát `from`. `returnHrefFor` đã xoá và không còn import. `detail-actions.js` vẫn gỡ `from` khi sao chép link.
- **Verifier:**
  - Bỏ comment/`<script>`/`<style>` (backreference chạy được cả khi khác hoa thường nhờ cờ `i`).
  - Giải mã entity một lượt.
  - `new URL(href, trang)` xử lý được href giao thức tương đối.
  - Host nội bộ gồm `site` và `LEGACY_HOSTS`.
  - Không tìm thấy dương tính giả thực tế.
- **Referrer-Policy:** production đang trả `strict-origin-when-cross-origin` (đã `curl -I` `/doi-chuan/`, `/khai-hoang/`). Nếu zone cũng thêm header thì trùng giá trị, vô hại.
- **Hash nguồn:** `pipeline/site-localization-policy.json` khớp working tree hiện tại; đã băm lại mọi đường dẫn có trong policy, 0 lệch.

## Ghi chú về working tree

Trong lúc review, working tree đổi ngoài nhánh này: thay đổi thanh đồng ý cookie xuất hiện rồi biến mất. Đó là `src/layouts/SiteLayout.astro` thêm `.ana-btn primary` cho nút Đồng ý, cùng comment trong `css/styles.css` và `tests-e2e/analytics-consent.spec.mjs`. Lúc kết thúc review các file này đã về đúng HEAD và hash trong policy khớp. Trước khi commit, kiểm lại để không lẫn thay đổi consent: nó ngoài phạm vi và đảo quyết định "Từ chối/Đồng ý ngang vai".

## Theo dõi plan

- Ba phase có vẻ đã làm xong: thư viện nguồn quay lại, wiring trang chi tiết và caller, verifier + E2E + docs. `plan.md` vẫn ghi `status: pending` và các phase "Pending"; để lead cập nhật.
- Tiêu chí "Astra audit diff: GO" chưa có bằng chứng trong repo.
- Sau khi sửa M1, nên bổ sung một dòng vào changelog mô tả rõ: referrer cùng origin không thuộc trang mục thì Quay lại về link mặc định.

## Hành động đề xuất

1. Sửa M1 (giới hạn fallback storage theo referrer) kèm unit test và E2E.
2. Cân nhắc L1 (hủy hoặc đặt trần cho bước hoãn khôi phục).
3. Đảm bảo commit không kèm thay đổi thanh đồng ý cookie.

## Metrics

- Type coverage: không đo (JS thuần).
- Test: theo caller, `test:node` 1115/1115, `test:dist` 77/77, `test:e2e` 804/804.
- Lint: không chạy.

## Câu hỏi còn mở

- Khi đi từ trang riêng Tra cứu `/tra-cuu/<nhóm>/<slug>/`, có muốn nút Quay lại về chính trang đó không? Allowlist hiện chỉ có trang nhóm `?id=`. Đây là giới hạn có từ trước, không do thay đổi này.

Status: DONE_WITH_CONCERNS
Summary: Lõi an toàn: không open redirect, xử lý storage và replaceState đúng, không còn link nào phát `from`. Còn một lỗi Medium: referrer cùng origin nhưng không phải trang mục (trang riêng Tra cứu, trang mùa, Landing, Đội của tôi) làm nút Quay lại lấy đích cũ từ sessionStorage thay vì link mặc định.
