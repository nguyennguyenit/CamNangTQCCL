// Bật/tắt các panel phiên bản hiệu ứng dựng sẵn trong HTML (trang riêng Tra cứu và panel chi tiết của trang nhóm).
// Không phụ thuộc module nào: trang riêng chỉ nạp file này và chân dung, không nạp cả bộ render/tra cứu.

/** Nút chọn phiên bản của cải tạo binh chủng/catalog (`[data-effect-tab]`): đổi `aria-pressed` và panel `[data-effect-panel]`. */
export function handleEffectTabClick(event) {
  const tab = event.target.closest?.("[data-effect-tab]");
  if (!tab) return false;
  const section = tab.closest(".lookup-detail-section");
  for (const other of section.querySelectorAll("[data-effect-tab]")) other.setAttribute("aria-pressed", String(other === tab));
  for (const body of section.querySelectorAll("[data-effect-panel]")) body.hidden = body.dataset.effectPanel !== tab.dataset.effectTab;
  return true;
}

/** Nút phiên bản của hiệu ứng chiến pháp (`.lookup-version-button`) trên trang riêng: bật panel `data-effect-panel` tương ứng. */
export function bindEffectVersionPanels(root) {
  const buttons = [...root.querySelectorAll(".lookup-version-button")];
  for (const button of buttons) {
    button.addEventListener("click", () => {
      for (const other of buttons) other.setAttribute("aria-pressed", other === button ? "true" : "false");
      for (const panel of root.querySelectorAll("[data-effect-panel]")) panel.hidden = panel.dataset.effectPanel !== button.dataset.effectVersion;
    });
  }
}
