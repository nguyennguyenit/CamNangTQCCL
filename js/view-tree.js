// Cây view thuần (không DOM): một định nghĩa markup cho cả HTML dựng lúc build (Astro) lẫn DOM của trình
// duyệt. Nút là `{tag, attrs, children}`; chữ là chuỗi. Thuộc tính `null`/`undefined`/`false` bị bỏ,
// `true` thành thuộc tính rỗng. Không có đường nào nhận HTML thô: chữ và thuộc tính luôn được escape/gán.

/** Một nút phần tử; con `null`/`false` bị bỏ, số thành chuỗi. */
export function h(tag, attrs = {}, children = []) {
  const kids = [].concat(children).filter((child) => child !== null && child !== undefined && child !== false)
    .map((child) => (typeof child === "object" ? child : String(child)));
  return { tag, attrs, children: kids };
}

const VOID = new Set(["img", "input", "br", "hr", "meta", "link"]);
const TEXT_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
const ATTR_ESCAPES = { ...TEXT_ESCAPES, '"': "&quot;" };
const escapeText = (value) => value.replace(/[&<>]/g, (char) => TEXT_ESCAPES[char]);
const escapeAttr = (value) => value.replace(/[&<>"]/g, (char) => ATTR_ESCAPES[char]);
const TAG = /^[a-z][a-z0-9-]*$/;
// Chữ hoa chỉ cần cho thuộc tính SVG như `viewBox`.
const ATTR = /^[a-zA-Z][a-zA-Z0-9:-]*$/;
const SVG_NS = "http://www.w3.org/2000/svg";

function attrEntries(attrs) {
  return Object.entries(attrs ?? {}).filter(([name, value]) => {
    if (!ATTR.test(name)) throw new Error(`Thuộc tính không hợp lệ: ${name}`);
    return value !== null && value !== undefined && value !== false;
  });
}

/** HTML của một cây view (dùng lúc build). */
export function treeToHtml(node) {
  if (typeof node === "string") return escapeText(node);
  if (!TAG.test(node.tag)) throw new Error(`Thẻ không hợp lệ: ${node.tag}`);
  const attrs = attrEntries(node.attrs)
    .map(([name, value]) => (value === true ? ` ${name}` : ` ${name}="${escapeAttr(String(value))}"`))
    .join("");
  if (VOID.has(node.tag)) return `<${node.tag}${attrs}>`;
  return `<${node.tag}${attrs}>${node.children.map(treeToHtml).join("")}</${node.tag}>`;
}

/**
 * DOM của một cây view (dùng trong trình duyệt), cùng cấu trúc với `treeToHtml`. Thẻ `svg` và mọi con của nó
 * được tạo bằng `createElementNS` để trình duyệt vẽ đúng như khi parse HTML.
 */
export function treeToDom(node, doc = globalThis.document, svg = false) {
  if (typeof node === "string") return doc.createTextNode(node);
  if (!TAG.test(node.tag)) throw new Error(`Thẻ không hợp lệ: ${node.tag}`);
  const inSvg = svg || node.tag === "svg";
  const element = inSvg ? doc.createElementNS(SVG_NS, node.tag) : doc.createElement(node.tag);
  for (const [name, value] of attrEntries(node.attrs)) element.setAttribute(name, value === true ? "" : String(value));
  for (const child of node.children) element.append(treeToDom(child, doc, inSvg));
  return element;
}

/**
 * Bản sao của cây mà mọi nút `button` thoả `matches(attrs)` mang `disabled` + `aria-disabled`: nút dựng sẵn lúc build
 * chưa có sự kiện nên bấm không làm gì cho đến khi trình duyệt gắn xong và gọi `enableControl`.
 */
export function disableButtons(node, matches) {
  if (typeof node === "string") return node;
  const attrs = node.tag === "button" && matches(node.attrs ?? {})
    ? { ...node.attrs, disabled: true, "aria-disabled": "true" }
    : node.attrs;
  return { tag: node.tag, attrs, children: node.children.map((child) => disableButtons(child, matches)) };
}

/** Bật lại nút dựng sẵn khi sự kiện của nó đã được gắn (đối ứng của `disableButtons`). */
export function enableControl(element) {
  element.removeAttribute("disabled");
  element.removeAttribute("aria-disabled");
}

const TEXT_BLOCKS = new Set([
  "address", "article", "aside", "blockquote", "details", "dd", "div", "dl", "dt", "fieldset", "figcaption", "figure", "footer",
  "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "li", "main", "nav", "ol", "p", "pre", "section", "summary",
  "table", "tbody", "tfoot", "thead", "tr", "ul",
]);
// Phần trang trí hoặc không phải chữ đọc được: không đưa vào bản chữ thuần.
const TEXT_SKIPPED = new Set(["script", "style", "svg", "img", "input", "link", "meta", "noscript", "template"]);

function textOf(node, out) {
  if (typeof node === "string") {
    out.push(node);
    return;
  }
  if (TEXT_SKIPPED.has(node.tag) || node.attrs?.["aria-hidden"] === "true") return;
  if (node.tag === "br") {
    out.push("\n");
    return;
  }
  if (node.tag === "tr") {
    const cells = node.children.map((cell) => treeToText(cell).replace(/\s*\n\s*/g, " ")).filter(Boolean);
    out.push("\n", cells.join(" | "), "\n");
    return;
  }
  const block = TEXT_BLOCKS.has(node.tag);
  out.push(block ? "\n" : " ");
  if (node.tag === "li") out.push("- ");
  for (const child of node.children) textOf(child, out);
  out.push(block ? "\n" : " ");
}

/**
 * Chữ thuần của một cây view (hoặc mảng cây) cho llms.txt: phần tử khối xuống dòng, mục danh sách mở bằng "- ", ô bảng
 * của một hàng ngăn bằng " | ", chữ của các phần tử dòng liền kề tách bằng một khoảng trắng. Bỏ `script`/`style`/`svg`/`img`
 * và phần tử `aria-hidden="true"`; phần tử `hidden` (bản hiệu ứng cũ) vẫn là nội dung nên được giữ.
 */
export function treeToText(tree) {
  const out = [];
  for (const node of [].concat(tree)) textOf(node, out);
  return out.join("")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/ ([,.;:!?)\]，。；：！？）、])/g, "$1")
    .replace(/([(\[（]) /g, "$1")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
