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
const ATTR = /^[a-z][a-z0-9:-]*$/;

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

/** DOM của một cây view (dùng trong trình duyệt), cùng cấu trúc với `treeToHtml`. */
export function treeToDom(node, doc = globalThis.document) {
  if (typeof node === "string") return doc.createTextNode(node);
  if (!TAG.test(node.tag)) throw new Error(`Thẻ không hợp lệ: ${node.tag}`);
  const element = doc.createElement(node.tag);
  for (const [name, value] of attrEntries(node.attrs)) element.setAttribute(name, value === true ? "" : String(value));
  for (const child of node.children) element.append(treeToDom(child, doc));
  return element;
}
