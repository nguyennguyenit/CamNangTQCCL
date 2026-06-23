import { test } from "node:test";
import assert from "node:assert/strict";
import { createMobileSectionMenu } from "../js/mobile-section-menu.js";

function fakeClassList() {
  const values = new Set();
  return {
    toggle(name, force) {
      const shouldAdd = force ?? !values.has(name);
      if (shouldAdd) values.add(name);
      else values.delete(name);
      return shouldAdd;
    },
    contains: (name) => values.has(name),
  };
}

function fakeElement(textContent = "") {
  const listeners = new Map();
  return {
    classList: fakeClassList(),
    textContent,
    dataset: {},
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
    getAttribute(name) {
      return this.attributes.get(name);
    },
  };
}

function fakeDocument() {
  let keydown;
  return {
    addEventListener(type, handler) {
      if (type === "keydown") keydown = handler;
    },
    pressEscape() {
      keydown?.({ key: "Escape" });
    },
  };
}

function setup() {
  const tabs = [
    fakeElement("Team PK"),
    fakeElement("Cùng Tồn"),
    fakeElement("Khai hoang"),
  ];
  tabs[0].dataset.section = "team-pk";
  tabs[1].dataset.section = "coexist";
  tabs[2].dataset.section = "khaihoang";
  const doc = fakeDocument();
  const menu = createMobileSectionMenu({
    nav: fakeElement(),
    toggle: fakeElement(),
    tabs,
    documentTarget: doc,
  });
  return { menu, doc };
}

test("mobile section menu opens and closes from toggle, tab, and Escape", () => {
  const { menu, doc } = setup();

  menu.toggle.click();
  assert.equal(menu.nav.classList.contains("open"), true);
  assert.equal(menu.toggle.getAttribute("aria-expanded"), "true");

  menu.tabs[1].click();
  assert.equal(menu.nav.classList.contains("open"), false);
  assert.equal(menu.toggle.getAttribute("aria-expanded"), "false");

  menu.open();
  doc.pressEscape();
  assert.equal(menu.nav.classList.contains("open"), false);
});

test("mobile section menu label follows active section", () => {
  const { menu } = setup();

  menu.setActive("coexist");

  assert.equal(menu.toggle.textContent, "☰ Cùng Tồn");
});
