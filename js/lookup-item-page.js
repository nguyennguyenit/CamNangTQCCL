// Trang riêng của một mục Tra cứu (`/tra-cuu/<nhóm>/<slug>/`): hồ sơ đã dựng sẵn lúc build bằng cùng cây view với hộp thoại,
// nên trình duyệt chỉ gắn phần tương tác: ảnh chân dung, nút chọn phiên bản hiệu ứng của chiến pháp và của cải tạo binh chủng.
// Không tải dữ liệu nào và chỉ nạp hai module không phụ thuộc gì khác; không có JavaScript thì toàn bộ hồ sơ vẫn đọc được
// (CSS hiện mọi bản hiệu ứng kèm nhãn khi `<html>` thiếu `data-lookup-js`, cờ do script inline trong <head> đặt).

import { activatePortraits } from "./hero-portrait.js";
import { bindEffectVersionPanels, handleEffectTabClick } from "./lookup-effect-panels.js";

const root = document.querySelector("[data-lookup-item-root]");
if (root) {
  activatePortraits(root);
  bindEffectVersionPanels(root);
  root.addEventListener("click", handleEffectTabClick);
}
document.body.dataset.boot = "ready";
