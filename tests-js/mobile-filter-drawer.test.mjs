import { test } from "node:test";
import assert from "node:assert/strict";
import { createMobileFilterDrawer } from "../js/mobile-filter-drawer.js";

function fakeClassList() {
  const values = new Set();
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
    toggle: (name, force) => {
      const shouldAdd = force ?? !values.has(name);
      if (shouldAdd) values.add(name);
      else values.delete(name);
      return shouldAdd;
    },
    contains: (name) => values.has(name),
  };
}

function fakeElement(doc) {
  const listeners = new Map();
  return {
    classList: fakeClassList(),
    attributes: new Map(),
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    click() {
      listeners.get("click")?.({ type: "click" });
    },
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    },
    removeAttribute(name) {
      this.attributes.delete(name);
    },
    getAttribute(name) {
      return this.attributes.get(name);
    },
    focus() {
      if (doc) doc.activeElement = this;
    },
    inert: false,
  };
}

function fakeDocument() {
  let keydown;
  return {
    addEventListener(type, handler) {
      if (type === "keydown") keydown = handler;
    },
    activeElement: null,
    pressEscape() {
      keydown?.({ key: "Escape" });
    },
  };
}

function fakeMedia(matches = true) {
  let change;
  return {
    matches,
    addEventListener(type, handler) {
      if (type === "change") change = handler;
    },
    setMatches(value) {
      this.matches = value;
      change?.({ matches: value });
    },
  };
}

function setup({ mobileMedia = fakeMedia(true) } = {}) {
  const doc = fakeDocument();
  const toggle = fakeElement(doc);
  const closeButton = fakeElement(doc);
  const drawer = createMobileFilterDrawer({
    panel: fakeElement(doc),
    overlay: fakeElement(doc),
    toggle,
    closeButtons: [closeButton, fakeElement(doc)],
    backgroundElements: [fakeElement(doc), fakeElement(doc)],
    documentTarget: doc,
    initialFocus: closeButton,
    mobileMedia,
  });
  return { drawer, doc, mobileMedia, toggle, closeButton };
}

test("mobile filter drawer opens from toggle and exposes expanded state", () => {
  const { drawer, doc, toggle, closeButton } = setup();

  doc.activeElement = toggle;
  assert.equal(drawer.panel.getAttribute("aria-hidden"), "true");

  drawer.toggle.click();

  assert.equal(drawer.panel.classList.contains("open"), true);
  assert.equal(drawer.overlay.classList.contains("open"), true);
  assert.equal(drawer.toggle.getAttribute("aria-expanded"), "true");
  assert.equal(drawer.panel.getAttribute("aria-hidden"), undefined);
  assert.equal(drawer.backgroundElements.every((el) => el.inert), true);
  assert.equal(doc.activeElement, closeButton);
});

test("mobile filter drawer closes from close buttons, overlay, escape, and section switch", () => {
  const { drawer, doc, toggle } = setup();

  for (const close of [...drawer.closeButtons, drawer.overlay, doc]) {
    doc.activeElement = toggle;
    drawer.open();
    if (close === doc) close.pressEscape();
    else close.click();
    assert.equal(drawer.panel.classList.contains("open"), false);
    assert.equal(drawer.overlay.classList.contains("open"), false);
    assert.equal(drawer.toggle.getAttribute("aria-expanded"), "false");
    assert.equal(drawer.panel.getAttribute("aria-hidden"), "true");
    assert.equal(drawer.backgroundElements.every((el) => !el.inert), true);
    assert.equal(doc.activeElement, toggle);
  }

  drawer.open();
  drawer.closeForSection("coexist");
  assert.equal(drawer.panel.classList.contains("open"), false);
});

test("mobile filter drawer does not close for Team PK section refresh", () => {
  const { drawer } = setup();

  drawer.open();
  drawer.closeForSection("team-pk");

  assert.equal(drawer.panel.classList.contains("open"), true);
});

test("mobile filter drawer closes when viewport leaves mobile mode", () => {
  const mobileMedia = fakeMedia(true);
  const { drawer } = setup({ mobileMedia });

  drawer.open();
  mobileMedia.setMatches(false);

  assert.equal(drawer.panel.classList.contains("open"), false);
  assert.equal(drawer.overlay.classList.contains("open"), false);
  assert.equal(drawer.toggle.getAttribute("aria-expanded"), "false");
  assert.equal(drawer.panel.getAttribute("aria-hidden"), undefined);
});

test("mobile filter drawer can close competing page menu before opening", () => {
  let openCalls = 0;
  const doc = fakeDocument();
  const drawer = createMobileFilterDrawer({
    panel: fakeElement(doc),
    overlay: fakeElement(doc),
    toggle: fakeElement(doc),
    closeButtons: [fakeElement(doc)],
    documentTarget: doc,
    onOpen: () => { openCalls += 1; },
  });

  drawer.open();

  assert.equal(openCalls, 1);
});

test("mobile filter drawer section close can redirect focus away from hidden filter action", () => {
  const { drawer, doc, toggle } = setup();
  const sectionMenuToggle = fakeElement(doc);

  doc.activeElement = toggle;
  drawer.open();
  drawer.closeForSection("coexist", { focusTarget: sectionMenuToggle });

  assert.equal(drawer.panel.classList.contains("open"), false);
  assert.equal(doc.activeElement, sectionMenuToggle);
});
