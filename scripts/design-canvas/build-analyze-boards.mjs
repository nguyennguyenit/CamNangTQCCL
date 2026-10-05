// Dựng artboard Soi đội từ ảnh từ các bản chụp của capture-analyze.mjs → .cache/design-canvas/boards/project/<Board>.dc.html.
//   node scripts/design-canvas/build-analyze-boards.mjs <stylesheet /_blob/id> <ảnh mẫu /_blob/id>
// Ảnh người dùng chọn (data: URI) đổi thành ảnh mẫu đã tải lên canvas: canvas không nhận data: URI.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, assetMap, renderPage } from './canvas-page.mjs';

const [stylesheet, sampleImage] = process.argv.slice(2);
if (!stylesheet || !sampleImage) throw new Error('cần <stylesheet /_blob/id> <ảnh mẫu /_blob/id>');
const WORK = join(REPO, '.cache/design-canvas');
const OUT = join(WORK, 'boards/project');
mkdirSync(OUT, { recursive: true });
const assets = assetMap(join(WORK, 'sitebuild'));

export const BOARDS = {
  Analyze: 'Soi đội từ ảnh — chọn ảnh',
  AnalyzeSides: 'Soi đội từ ảnh — chọn phe (ảnh hai phe)',
  AnalyzeReview: 'Soi đội từ ảnh — kiểm tra đội',
  AnalyzeResult: 'Soi đội từ ảnh — đối chiếu',
};

const heights = {};
for (const [name, title] of Object.entries(BOARDS)) {
  for (const [suffix, width] of [['', 1440], ['Mobile', 390]]) {
    const board = name + suffix;
    const capture = JSON.parse(readFileSync(join(WORK, 'captures', `${board}.json`), 'utf8'));
    capture.html = capture.html.replace(/src="data:image\/[^"]+"/g, `src="${sampleImage}"`);
    const html = renderPage({ title: title + (suffix ? ' (mobile)' : ''), width, height: capture.height, capture, stylesheet, assets });
    if (/data:image/.test(html)) throw new Error(`${board}: còn data: URI`);
    writeFileSync(join(OUT, `${board}.dc.html`), html);
    heights[board] = capture.height;
  }
}
writeFileSync(join(WORK, 'boards/heights-analyze.json'), JSON.stringify(heights, null, 2));
console.log(heights);
