/*
 * support.js — shim tự viết để dựng artboard Design Component (.dc.html)
 * ngoài canvas. KHÔNG phải runtime gốc của canvas.
 *
 * Chỉ hỗ trợ đúng cấu trúc bản chụp đang dùng:
 *   <x-dc>, <helmet>, <sc-if value>, <sc-for list as>, {{ đường.dẫn }},
 *   onClick="{{ hàm }}", <script type="text/x-dc" data-props> với
 *   class Component extends DCLogic { baseVals() / renderVals() }, this.props,
 *   this.state / this.setState.
 * Gặp cấu trúc lạ hoặc biến không có → dừng và báo lỗi, không dựng thiếu.
 *
 * Phải mở qua HTTP (shim đọc lại mã nguồn trang, vì trình duyệt tự dời
 * <sc-for> nằm trong <table>/<tr>): node scripts/design-capture.mjs --serve
 */
(() => {
  'use strict';

  const PATH = /^[A-Za-z_$][\w$]*(?:\.[\w$]+)*$/;
  const LITERALS = { true: true, false: false, null: null };
  const INTERPOLATION = /\{\{\s*([^{}]*?)\s*\}\}/g;

  class DCError extends Error {}

  function fail(message) {
    throw new DCError(message);
  }

  class DCLogic {
    constructor(props) {
      this.props = props;
      this.state = {};
    }

    setState(patch) {
      this.state = Object.assign({}, this.state, patch);
      render();
    }
  }
  window.DCLogic = DCLogic;

  let component = null;
  let template = null;
  let root = null;
  let renders = 0;

  function lookup(expression, scope) {
    const expr = expression.trim();
    if (Object.hasOwn(LITERALS, expr)) return LITERALS[expr];
    if (!PATH.test(expr)) fail(`Biểu thức không hỗ trợ: {{${expr}}}`);
    const [head, ...rest] = expr.split('.');
    if (!(head in scope)) fail(`Không có biến "${head}" trong {{${expr}}}`);
    let value = scope[head];
    for (const key of rest) {
      if (value === null || value === undefined) fail(`"${expr}": dừng ở giá trị rỗng trước ".${key}"`);
      value = value[key];
    }
    if (value === undefined) fail(`"${expr}" không có giá trị`);
    return value;
  }

  function interpolate(text, scope) {
    if (!text.includes('{{')) return text;
    const out = text.replace(INTERPOLATION, (_, expr) => {
      const value = lookup(expr, scope);
      if (value !== null && typeof value === 'object') fail(`"${expr}" là object/mảng, không chèn được vào chữ`);
      return value === null ? '' : String(value);
    });
    if (out.includes('{{')) fail(`Còn sót "{{" sau khi chèn: ${out.slice(0, 80)}`);
    return out;
  }

  function soleExpression(value) {
    const match = /^\s*\{\{\s*([^{}]*?)\s*\}\}\s*$/.exec(value);
    return match ? match[1] : null;
  }

  function renderInto(source, target, scope) {
    for (const node of source.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        target.append(document.createTextNode(interpolate(node.data, scope)));
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue;

      if (node.localName === 'template') {
        const kind = node.getAttribute('data-sc');
        if (kind === 'if') {
          const expr = soleExpression(node.getAttribute('value') ?? '');
          if (expr === null) fail('<sc-if> thiếu value="{{…}}"');
          if (lookup(expr, scope)) renderInto(node.content, target, scope);
        } else if (kind === 'for') {
          const expr = soleExpression(node.getAttribute('list') ?? '');
          const name = node.getAttribute('as');
          if (expr === null || !name) fail('<sc-for> thiếu list="{{…}}" hoặc as');
          const list = lookup(expr, scope);
          if (!Array.isArray(list)) fail(`<sc-for list="{{${expr}}}"> không phải mảng`);
          for (const item of list) {
            const inner = Object.create(scope);
            inner[name] = item;
            renderInto(node.content, target, inner);
          }
        } else {
          fail('Gặp <template> không phải sc-if/sc-for');
        }
        continue;
      }
      if (node.localName.startsWith('sc-')) fail(`Thẻ không hỗ trợ: <${node.localName}>`);

      const element = document.importNode(node, false);
      for (const { name, value } of [...node.attributes]) {
        if (name.startsWith('on')) {
          const expr = soleExpression(value);
          if (expr === null) fail(`Thuộc tính ${name} phải là "{{hàm}}"`);
          const handler = lookup(expr, scope);
          if (typeof handler !== 'function') fail(`${name}="{{${expr}}}" không phải hàm`);
          element.removeAttribute(name);
          element.addEventListener(name.slice(2), handler);
        } else if (value.includes('{{')) {
          element.setAttribute(name, interpolate(value, scope));
        }
      }
      renderInto(node, element, scope);
      target.append(element);
    }
  }

  function render() {
    try {
      const base = typeof component.baseVals === 'function' ? component.baseVals() : {};
      const extra = typeof component.renderVals === 'function' ? component.renderVals() : {};
      const fragment = document.createDocumentFragment();
      renderInto(template.content, fragment, Object.assign({}, base, extra));
      root.replaceChildren(fragment);
      document.documentElement.dataset.dcReady = String(++renders);
    } catch (error) {
      report(error);
    }
  }

  function report(error) {
    const message = error instanceof DCError ? error.message : `${error.name}: ${error.message}`;
    document.documentElement.dataset.dcError = message;
    const banner = document.createElement('pre');
    banner.setAttribute('role', 'alert');
    banner.style.cssText = 'margin:0;padding:12px 16px;background:#7E1620;color:#fff;font:13px/1.5 ui-monospace,monospace;white-space:pre-wrap;';
    banner.textContent = `support.js: ${message}`;
    document.body.prepend(banner);
    console.error('[support.js]', error);
  }

  function slice(html, open, close) {
    const start = html.indexOf(open);
    const end = html.indexOf(close, start + open.length);
    if (start < 0 || end < 0) fail(`Không tìm thấy ${open}…${close}`);
    return html.slice(start + open.length, end);
  }

  async function boot() {
    if (location.protocol === 'file:') {
      fail('Cần mở qua HTTP: node scripts/design-capture.mjs --serve');
    }
    const response = await fetch(location.href, { cache: 'no-store' });
    if (!response.ok) fail(`Không đọc lại được trang (${response.status})`);
    const html = await response.text();

    let body = slice(html, '<x-dc>', '</x-dc>');
    if (body.includes('<helmet>')) {
      document.head.insertAdjacentHTML('beforeend', slice(body, '<helmet>', '</helmet>'));
      body = body.replace(/<helmet>[\s\S]*?<\/helmet>/, '');
    }
    const converted = body
      .replace(/<sc-(if|for)\b/g, '<template data-sc="$1"')
      .replace(/<\/sc-(?:if|for)>/g, '</template>');
    const stray = /<\/?sc-[a-z-]*/.exec(converted);
    if (stray) fail(`Thẻ không hỗ trợ: ${stray[0]}`);
    template = document.createElement('template');
    template.innerHTML = converted;

    const script = new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector('script[type="text/x-dc"]');
    if (!script) fail('Không có <script type="text/x-dc">');
    const spec = JSON.parse(script.getAttribute('data-props') || '{}');
    const props = {};
    for (const [key, value] of Object.entries(spec)) {
      if (!key.startsWith('$')) props[key] = value && typeof value === 'object' ? value.default : value;
    }
    const Component = new Function('DCLogic', `${script.textContent}\nreturn Component;`)(DCLogic);
    component = new Component(props);

    root = document.createElement('div');
    root.setAttribute('data-dc-root', '');
    document.body.replaceChildren(root);
    render();
  }

  document.addEventListener('DOMContentLoaded', () => {
    boot().catch(report);
  });
})();
