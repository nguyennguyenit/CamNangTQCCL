// Chạy trong trang (page.evaluate): tuần tự hoá <body> của site thật thành HTML hợp lệ cho artboard .dc.html.
// Giữ class (artboard dùng chung stylesheet của site), đóng mọi thẻ, bỏ script/dialog đóng và phần tử display:none.
// Nút có aria-controls mà panel đang ẩn/mở → panel bọc <sc-if>, nút gắn onClick (state của DCLogic, xem canvas-page.mjs).
export function serializeBody() {
  const SKIP = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE', 'ASTRO-DEV-TOOLBAR', 'IFRAME']);
  const VOID = new Set(['AREA', 'BASE', 'BR', 'COL', 'EMBED', 'HR', 'IMG', 'INPUT', 'LINK', 'META', 'SOURCE', 'TRACK', 'WBR']);
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\{\{/g, '{&#123;');
  const escAttr = (s) => esc(s).replace(/"/g, '&quot;');
  const toggles = [];
  for (const btn of document.querySelectorAll('[aria-expanded][aria-controls]')) {
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    if (!panel || !btn.getClientRects().length) continue;
    const key = btn.getAttribute('aria-controls').replace(/[^A-Za-z0-9]/g, '_');
    const hidden = getComputedStyle(panel).display === 'none';
    const open = btn.getAttribute('aria-expanded') === 'true';
    if (!hidden && !open) continue;
    btn.setAttribute('data-dc-toggle', key);
    panel.setAttribute('data-dc-panel', key);
    toggles.push({ key, open });
  }
  const imgs = new Set();
  const attrs = (el) => {
    let out = '';
    for (const a of el.attributes) {
      const n = a.name;
      if (/^on/i.test(n) || n === 'srcset' || n === 'hidden' || n.startsWith('data-astro') || n.startsWith('data-dc-')) continue;
      let v = a.value;
      if (n === 'src' && el.tagName === 'IMG') imgs.add(v);
      if (el.tagName === 'INPUT' && n === 'value') v = el.value;
      out += v === '' ? ` ${n}=""` : ` ${n}="${escAttr(v)}"`;
    }
    if (el.tagName === 'INPUT' && !el.hasAttribute('value') && el.value && el.type !== 'file') out += ` value="${escAttr(el.value)}"`;
    if (el.tagName === 'INPUT' && el.type === 'checkbox' && el.checked && !el.hasAttribute('checked')) out += ' checked=""';
    const k = el.getAttribute('data-dc-toggle');
    if (k) out = out.replace(/ aria-expanded="[^"]*"/, '') + ` aria-expanded="{{exp_${k}}}" onClick="{{toggle_${k}}}"`;
    return out;
  };
  const walk = (node) => {
    if (node.nodeType === 3) return esc(node.data);
    if (node.nodeType !== 1 || SKIP.has(node.tagName)) return '';
    if (node.tagName === 'DIALOG' && !node.open) return '';
    const panel = node.getAttribute('data-dc-panel');
    if (!panel && getComputedStyle(node).display === 'none' && node.tagName !== 'svg') return '';
    let html;
    if (node.namespaceURI === 'http://www.w3.org/2000/svg') html = node.outerHTML.replace(/\s(on\w+)="[^"]*"/gi, '');
    else {
      const tag = node.tagName.toLowerCase();
      html = `<${tag}${attrs(node)}>`;
      if (!VOID.has(node.tagName)) {
        html += node.tagName === 'TEXTAREA' ? esc(node.value) : [...node.childNodes].map(walk).join('');
        html += `</${tag}>`;
      }
    }
    return panel ? `<sc-if value="{{open_${panel}}}" hint-placeholder-val="{{ false }}">${html}</sc-if>` : html;
  };
  return {
    html: [...document.body.childNodes].map(walk).join(''),
    bodyAttrs: [...document.body.attributes].map((a) => [a.name, a.value]),
    toggles,
    imgs: [...imgs],
    height: document.documentElement.scrollHeight,
  };
}
