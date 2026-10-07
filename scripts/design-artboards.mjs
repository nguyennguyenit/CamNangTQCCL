// Hàm dùng chung cho công cụ design "Sổ binh pháp": liệt kê artboard và phục vụ thư mục qua HTTP.
// `design-capture.mjs` (chụp ảnh chuẩn) và `design-compare.mjs`/`design-tokens.mjs` (soát phase) cùng import.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DESIGN_DIR = fileURLToPath(new URL('../docs/design/so-binh-phap/', import.meta.url));
export const PROJECT_DIR = join(DESIGN_DIR, 'project');
export const SCREENS_DIR = join(DESIGN_DIR, 'screens');
export const CANVAS_PATH = join(PROJECT_DIR, 'canvas.json');
/** 3 artboard hướng A/B/C chỉ để so sánh — không bao giờ chụp hay soát. */
export const SKIPPED = /^Dir[ABC]-/;
export const STYLE_GUIDE = 'StyleGuide';
export const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/** Mọi artboard có thật trong canvas, bỏ 3 hướng A/B/C, sắp theo tên. */
export async function artboards({ skip = SKIPPED } = {}) {
  const canvas = JSON.parse(await readFile(CANVAS_PATH, 'utf8'));
  return Object.entries(canvas.boards)
    .filter(([file]) => !skip.test(file))
    .map(([file, { w, h, title }]) => ({
      file,
      name: file.replace(/\.dc\.html$/, ''),
      width: w,
      height: h,
      title,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** 24 artboard trang: bỏ 3 hướng A/B/C và StyleGuide (StyleGuide chỉ định nghĩa màu). */
export async function pageArtboards() {
  return (await artboards()).filter((board) => board.name !== STYLE_GUIDE);
}

/**
 * Asset canvas (`/_blob/<id>`, không có đuôi file) được lưu kèm trong `project/_blob/`: đoán kiểu theo nội dung
 * để trình duyệt chịu áp stylesheet (kiểm MIME nghiêm) và font của các artboard dựng từ site thật.
 */
function blobType(body) {
  if (body.subarray(0, 4).toString('latin1') === 'wOF2') return 'font/woff2';
  if (body[0] === 0x89 && body.subarray(1, 4).toString('latin1') === 'PNG') return 'image/png';
  if (body[0] === 0xff && body[1] === 0xd8) return 'image/jpeg';
  if (/^\s*<(svg|\?xml)/.test(body.subarray(0, 64).toString('utf8'))) return 'image/svg+xml';
  return 'text/css; charset=utf-8';
}

/** Server tĩnh chỉ trong thư mục `root`; dùng cho artboard và trang so ảnh tạm. */
export function serve(root = PROJECT_DIR) {
  const base = resolve(root);
  const server = createServer(async (request, response) => {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(base, `.${path.endsWith('/') ? `${path}index.html` : path}`);
    if (file !== base && !file.startsWith(base + sep)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(file);
      const type = MIME_TYPES[extname(file)] ?? (path.startsWith('/_blob/') ? blobType(body) : 'application/octet-stream');
      response.writeHead(200, { 'content-type': type }).end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done(server)));
}
