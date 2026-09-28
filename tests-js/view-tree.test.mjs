// js/view-tree.js — một cây markup cho HTML dựng lúc build và DOM của trình duyệt.
import { test } from "node:test";
import assert from "node:assert/strict";
import { h, treeToDom, treeToHtml } from "../js/view-tree.js";

/** Document tối thiểu: đủ để `treeToDom` dựng cây và tuần tự hoá lại như trình duyệt (`outerHTML`). */
function fakeDocument() {
  const escapeText = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapeAttr = (value) => escapeText(value).replace(/"/g, "&quot;");
  const VOID = new Set(["img", "input"]);
  const text = (value) => ({ serialize: () => escapeText(value) });
  const element = (tag) => {
    const attrs = [];
    const children = [];
    return {
      setAttribute(name, value) { attrs.push([name, String(value)]); },
      append(child) { children.push(child); },
      serialize() {
        const open = `<${tag}${attrs.map(([name, value]) => ` ${name}${value === "" ? "" : `="${escapeAttr(value)}"`}`).join("")}>`;
        return VOID.has(tag) ? open : `${open}${children.map((child) => child.serialize()).join("")}</${tag}>`;
      },
    };
  };
  return { createElement: element, createTextNode: text };
}

test("HTML dựng lúc build trùng DOM dựng trong trình duyệt cho cùng cây", () => {
  const tree = h("article", { class: "lookup-card" }, [
    h("button", { type: "button", "data-lookup-id": "hero:luu-bi", hidden: true, disabled: false, title: null }, [
      h("img", { src: "https://a.example/x.png?a=1&b=2", alt: "Lưu \"Bị\"" }),
      "Tào <Tháo> & Lưu Bị",
      7,
      null,
    ]),
  ]);
  assert.equal(treeToDom(tree, fakeDocument()).serialize(), treeToHtml(tree));
});

test("chữ và thuộc tính luôn được escape, không đường nào chèn HTML thô", () => {
  const html = treeToHtml(h("p", { "data-x": '"><script>alert(1)</script>' }, ["<img src=x onerror=alert(1)>"]));
  assert.equal(html, '<p data-x="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;">&lt;img src=x onerror=alert(1)&gt;</p>');
  assert.throws(() => treeToHtml(h("p", { "on click": "x" })), /Thuộc tính/);
  assert.throws(() => treeToHtml(h("scr ipt")), /Thẻ/);
});
