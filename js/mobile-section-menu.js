// Mobile page section menu. Desktop keeps the normal tab row via CSS.

export function createMobileSectionMenu({ nav, toggle, tabs, documentTarget = document }) {
  function setOpen(isOpen) {
    nav.classList.toggle("open", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
  }

  function open() {
    setOpen(true);
  }

  function close() {
    setOpen(false);
  }

  function setActive(sectionName) {
    const active = tabs.find((tab) => tab.dataset.section === sectionName) || tabs[0];
    const label = active.textContent.trim();
    if (toggle.dataset.labelMode === "icon") {
      toggle.textContent = "☰";
      toggle.setAttribute("aria-label", `Mở menu trang: ${label}`);
      return;
    }
    toggle.textContent = `☰ ${label}`;
  }

  toggle.addEventListener("click", () => {
    nav.classList.contains("open") ? close() : open();
  });
  for (const tab of tabs) tab.addEventListener("click", close);
  documentTarget.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
  setOpen(false);

  return { nav, toggle, tabs, open, close, setActive };
}
