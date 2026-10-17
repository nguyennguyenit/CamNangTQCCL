# PR #9: nhãn phiên bản hiệu ứng trong llms và trang không JavaScript

Sửa theo review PR #9 (commit `ae23924`). Chưa commit, chưa push.

## Lỗi
- Trang riêng Chiến pháp / Cải tạo binh chủng có nhiều phiên bản hiệu ứng (80 trang bản Việt; bản Trung cùng cấu trúc) chỉ đặt nhãn phiên bản trên nút chọn; panel `data-effect-panel` không mang nhãn. `treeToText` giữ mọi panel nhưng bỏ thuộc tính, nên `/llms/tra-cuu/*.txt` gom mọi nhãn vào một dòng rồi nối các đoạn hiệu ứng liền nhau (Kim Đan Bí Thuật, Hổ Báo Kỵ: không biết đoạn nào là bản hiện hành).
- Không JavaScript: bản cũ mang `hidden` và nút không làm gì, trái với chú thích "toàn bộ hồ sơ vẫn đọc được".

## Sửa
- `effectSection` (`js/lookup-tactic-profile.js`) và `troopDetail` (`js/lookup-master.js`): khi có hơn một bản, mỗi panel mở bằng `<p class="lookup-version-tag lookup-effect-version-label">` cùng chữ với nút. Hàm nhãn khai trong chính hàm cũ để obligation dịch không đổi owner.
- `LookupItemPage.astro` đặt `<html data-lookup-js>` trong head (như trang nhóm). CSS: có JS thì ẩn nhãn (nút đã nói bản nào), bản cũ giữ `hidden`; không JS thì ẩn nút, hiện mọi panel kèm nhãn.
- Republish localization (hash 3 file nguồn), generation Đội chuẩn `ff7b77eb…` → `5d9358db…`, re-pin `pipeline/team-route-handles.json`; changelog sửa luôn mã generation ghi sai (`82e9d065…`).

## Xác minh
Test mới trong `tests-js/lookup-profile-trees.test.mjs` đỏ trước sửa (panel thiếu nhãn), xanh sau. `build` 4917 trang, `verify` OK, `test:dist` 49/49, `test:node` 595/595, `unittest` OK, `check:workflow-build` OK, e2e `lookup-item-pages` + `unified-lookup` 124/124. Chrome: có JS đổi bản đúng, nhãn ẩn; tắt JS mọi bản hiện kèm nhãn, nút ẩn (trang riêng và trang nhóm Cải tạo).

## PR body
- Đổi `Closes #6` → `Relates to #6`, thêm mục "Not in this PR" ghi trang mùa còn lại. Bẫy: câu "does not close #6" vẫn bị GitHub đọc là từ khóa đóng issue; đã viết lại, `closingIssuesReferences` nay chỉ còn `[7]`.

## Còn lại
- Commit + push các thay đổi local (chưa được yêu cầu). Mô tả PR vẫn ghi generation `ff7b77eb…` của commit đã push; cập nhật khi push bản sửa.
