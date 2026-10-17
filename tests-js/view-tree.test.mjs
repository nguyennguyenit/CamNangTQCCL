// js/view-tree.js — một cây markup cho HTML dựng lúc build và DOM của trình duyệt.
import { test } from "node:test";
import assert from "node:assert/strict";
import { h, treeToDom, treeToHtml, treeToText } from "../js/view-tree.js";

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

test("thẻ svg và con của nó dựng bằng createElementNS, thuộc tính viewBox giữ chữ hoa", () => {
  const made = [];
  const doc = {
    createElement: (tag) => { made.push(["html", tag]); return { setAttribute() {}, append() {} }; },
    createElementNS: (ns, tag) => { made.push([ns, tag]); return { setAttribute() {}, append() {} }; },
    createTextNode: (value) => value,
  };
  const tree = h("a", { href: "/x/" }, [h("svg", { viewBox: "0 0 24 24" }, [h("path", { d: "M9 6l6 6-6 6" })]), h("span", {}, "ok")]);
  treeToDom(tree, doc);
  assert.deepEqual(made, [["html", "a"], ["http://www.w3.org/2000/svg", "svg"], ["http://www.w3.org/2000/svg", "path"], ["html", "span"]]);
  assert.equal(treeToHtml(tree), '<a href="/x/"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"></path></svg><span>ok</span></a>');
});

test("treeToText: chữ thuần của cây — khối xuống dòng, ô bảng ngăn bằng |, chữ liền kề tách bằng khoảng trắng, bỏ phần trang trí", () => {
  const tree = h("article", {}, [
    h("h1", {}, "Tiềm Long Điêu Thuyền"),
    h("p", {}, [h("span", {}, "Tier"), h("span", {}, "T0"), " · ", h("a", { href: "/x/" }, "Chi tiết")]),
    h("svg", { viewBox: "0 0 1 1" }, [h("path", {})]),
    h("span", { "aria-hidden": "true" }, "①"),
    h("img", { src: "a.png", alt: "ảnh" }),
    h("ul", {}, [h("li", {}, "Một"), h("li", {}, ["Hai ", h("b", {}, "đậm")])]),
    h("table", {}, [h("tbody", {}, [h("tr", {}, [h("th", {}, "Tên"), h("td", {}, "Giá trị")]), h("tr", {}, [h("td", {}, "A"), h("td", {}, "")])])]),
    h("p", { hidden: true }, ["Bản cũ", h("br"), "dòng sau"]),
    h("script", {}, "alert(1)"),
  ]);
  assert.equal(treeToText(tree), [
    "Tiềm Long Điêu Thuyền",
    "Tier T0 · Chi tiết",
    "- Một",
    "- Hai đậm",
    "Tên | Giá trị",
    "A",
    "Bản cũ",
    "dòng sau",
  ].join("\n"));
  assert.equal(treeToText("A & <b>"), "A & <b>");
  assert.equal(treeToText([h("p", {}, "x"), h("p", {}, "y")]), "x\ny");
});
