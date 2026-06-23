// Mobile Team PK filter drawer behavior. Kept DOM-only and small for Node tests.

export function createMobileFilterDrawer({
  panel,
  overlay,
  toggle,
  closeButtons = [],
  backgroundElements = [],
  documentTarget = document,
  initialFocus = closeButtons[0],
  onOpen = () => {},
  mobileMedia = { matches: true },
}) {
  let returnFocusTarget = null;

  function setBackgroundAccessibility(isOpen) {
    const shouldHide = mobileMedia.matches && isOpen;
    for (const element of backgroundElements) {
      element.inert = shouldHide;
      if (shouldHide) element.setAttribute("aria-hidden", "true");
      else element.removeAttribute("aria-hidden");
    }
  }

  function setPanelAccessibility(isOpen) {
    if (!mobileMedia.matches) {
      panel.removeAttribute("aria-hidden");
      panel.inert = false;
      setBackgroundAccessibility(false);
      return;
    }
    if (isOpen) {
      panel.removeAttribute("aria-hidden");
      panel.inert = false;
      return;
    }
    panel.setAttribute("aria-hidden", "true");
    panel.inert = true;
  }

  function setOpen(isOpen, { restoreFocus = true } = {}) {
    if (isOpen) returnFocusTarget = documentTarget.activeElement;
    panel.classList.toggle("open", isOpen);
    overlay.classList.toggle("open", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
    setPanelAccessibility(isOpen);
    setBackgroundAccessibility(isOpen);
    if (isOpen) {
      initialFocus?.focus?.();
    } else if (restoreFocus?.focus) {
      restoreFocus.focus();
      returnFocusTarget = null;
    } else if (restoreFocus && returnFocusTarget?.focus) {
      returnFocusTarget.focus();
      returnFocusTarget = null;
    }
  }

  function open() {
    onOpen();
    setOpen(true);
  }

  function close(options = {}) {
    const nextOptions = options.focusTarget ? { ...options, restoreFocus: options.focusTarget } : options;
    setOpen(false, nextOptions);
  }

  toggle.addEventListener("click", () => {
    panel.classList.contains("open") ? close() : open();
  });
  overlay.addEventListener("click", close);
  for (const btn of closeButtons) btn.addEventListener("click", close);
  documentTarget.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
  mobileMedia.addEventListener?.("change", () => {
    if (!mobileMedia.matches) close();
    else setPanelAccessibility(panel.classList.contains("open"));
  });
  setOpen(false, { restoreFocus: false });

  return {
    panel,
    overlay,
    toggle,
    closeButtons,
    backgroundElements,
    open,
    close,
    closeForSection(sectionName, options = {}) {
      if (sectionName !== "team-pk") close(options);
    },
  };
}
