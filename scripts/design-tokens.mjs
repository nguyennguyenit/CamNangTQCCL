#!/usr/bin/env node
// Token "Sổ binh pháp" — một nguồn máy đọc được cho màu và mọi giá trị vi mô.
//
//   node scripts/design-tokens.mjs --extract [--report <file>]
//     Báo cáo tần suất giá trị inline style của 24 artboard trang + `renderVals()` của StyleGuide,
//     kèm số giá trị thô còn lại trong `css/styles.css` (theo khối legacy).
//   node scripts/design-tokens.mjs --check
//     Khối `:root` / `:root[data-theme="dark"]` của `css/styles.css` phải khớp `tokens.json`;
//     không mã màu ngoài khối token; không giá trị vi mô thô ngoài khối legacy, và số giá trị thô
//     trong khối legacy không được vượt `ceiling` ghi ở comment `/* legacy:start ceiling=<N> */`.
//
// tokens.json là golden master vi mô (plan.md quyết định #15). Mọi giá trị ở đây lấy từ artboard,
// không làm tròn; mỗi token ghi nguồn. Quy tắc sinh custom property: mỗi token khai `var` của nó;
// khối sáng phát mọi token theo thứ tự trong JSON, khối tối phát lại các token có giá trị `dark`.
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PROJECT_DIR, STYLE_GUIDE, pageArtboards } from './design-artboards.mjs';

export const ROOT_DIR = fileURLToPath(new URL('../', import.meta.url));
export const TOKENS_PATH = join(ROOT_DIR, 'docs/design/so-binh-phap/tokens.json');
export const CSS_PATH = join(ROOT_DIR, 'css/styles.css');

/** Comment mốc khối legacy; `ceiling` là số giá trị vi mô thô tối đa còn được phép. */
export const LEGACY_START = /\/\* legacy:start ceiling=(\d+) \*\//;
export const LEGACY_END = '/* legacy:end */';

/** Thuộc tính bị soát giá trị thô (Verification của Phase 1). */
export const CHECKED_PROPERTIES = Object.freeze([
  /^color$/,
  /^background(-color)?$/,
  /^border(-(top|right|bottom|left))?-color$/,
  /^font-size$/,
  /^line-height$/,
  /^letter-spacing$/,
  /^font-weight$/,
  /^padding(-(top|right|bottom|left|block|inline)(-(start|end))?)?$/,
  /^margin(-(top|right|bottom|left|block|inline)(-(start|end))?)?$/,
  /^gap$/,
  /^row-gap$/,
  /^column-gap$/,
  /^border-radius$/,
  /^min-height$/,
  /^height$/,
  /^box-shadow$/,
  /^z-index$/,
  /^font$/,
]);

/** Giá trị thô được phép theo Verification (0, auto, 100%, viền 1px, inherit, currentColor). */
const ALLOWED_LITERALS = new Set(['0', 'auto', '100%', 'inherit', 'currentColor', 'transparent']);
const NUMERIC_LITERAL = /-?\d*\.?\d+(?:px|rem|em|%|vh|vw|vmin|vmax|pt|ch|ex)?/g;
const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g;

/** Thuộc tính bị soát: danh sách trên + mọi custom property khai ngoài khối token (N4). */
const isChecked = (property) => property.startsWith('--') || CHECKED_PROPERTIES.some((pattern) => pattern.test(property));

/** Tách khai báo của một khối CSS (không có khối lồng nhau) thành cặp thuộc tính/giá trị. */
function declarations(block) {
  const found = [];
  for (const chunk of block.split(';')) {
    const at = chunk.indexOf(':');
    if (at <= 0) continue;
    const property = chunk.slice(0, at).trim().toLowerCase();
    const value = chunk.slice(at + 1).trim().replace(/\s+/g, ' ');
    if (!property || !value) continue;
    found.push({ property, value });
  }
  return found;
}

/** Quét mọi `selector { … }` của một đoạn CSS (kể cả khối trong `@media`); comment bị bỏ trước khi quét. */
export function cssRules(source) {
  const rules = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  for (const [, selector, block] of source.replace(/\/\*[\s\S]*?\*\//g, ' ').matchAll(pattern)) {
    rules.push({ selector: selector.trim().replace(/\s+/g, ' '), declarations: declarations(block) });
  }
  return rules;
}

/** Danh sách custom property của một khối `:root` theo đúng thứ tự khai báo (bỏ comment). */
function customProperties(block) {
  return block
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(';')
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.startsWith('--') && chunk.includes(':'))
    .map((chunk) => {
      const at = chunk.indexOf(':');
      return [chunk.slice(0, at).trim(), chunk.slice(at + 1).trim().replace(/\s+/g, ' ')];
    });
}

/**
 * Tách `css/styles.css` thành các vùng soát: 2 khối token, khối legacy (có mốc `ceiling`), phần CSS mới.
 */
export function splitStylesheet(source) {
  const light = source.match(/:root\s*\{([^{}]*)\}/);
  const dark = source.match(/:root\[data-theme="dark"\]\s*\{([^{}]*)\}/);
  if (!light || !dark) throw new Error('css/styles.css phải có khối :root và :root[data-theme="dark"]');
  const start = source.match(LEGACY_START);
  const end = source.indexOf(LEGACY_END);
  if (!start || end < 0) throw new Error(`css/styles.css phải có cặp comment ${LEGACY_START.source} … ${LEGACY_END}`);
  const legacyStart = source.indexOf(start[0]);
  const withoutTokens = source.replace(light[0], '').replace(dark[0], '');
  const legacy = source.slice(legacyStart, end + LEGACY_END.length);
  const fresh = withoutTokens.replace(legacy, '');
  return {
    light: customProperties(light[1]),
    dark: customProperties(dark[1]),
    legacyCeiling: Number(start[1]),
    legacy,
    fresh,
  };
}

/** Tham chiếu token `var(--x)` không phải giá trị thô; chỉ phần còn lại được đếm. */
const VAR_REFERENCE = /var\(\s*--[a-z0-9-]+\s*\)/gi;

/** Giá trị vi mô thô của một khai báo, theo Verification: bỏ qua literal được phép và viền 1px. */
export function rawLiterals({ property, value }) {
  if (!isChecked(property)) return [];
  const borderish = /^(border|outline)/.test(property) || /\b(?:solid|dashed|dotted)\b/.test(value);
  const raw = [];
  for (const [literal] of value.replace(VAR_REFERENCE, ' ').matchAll(NUMERIC_LITERAL)) {
    if (ALLOWED_LITERALS.has(literal)) continue;
    if (literal === '1px' && borderish) continue;
    raw.push(literal);
  }
  return raw;
}

/** Mã màu literal ngoài khối token (hex, rgb(), hsl()) — mọi theme/phase dùng token. */
export function colorLiterals(value) {
  return [...value.replace(VAR_REFERENCE, ' ').matchAll(COLOR_LITERAL)].map(([literal]) => literal);
}

/** Tổng hợp giá trị thô của một vùng CSS: theo selector và theo thuộc tính. */
function tallyRawValues(source) {
  const bySelector = new Map();
  const byProperty = new Map();
  let total = 0;
  for (const { selector, declarations: list } of cssRules(source)) {
    for (const declaration of list) {
      const literals = rawLiterals(declaration);
      if (!literals.length) continue;
      total += literals.length;
      bySelector.set(selector, (bySelector.get(selector) ?? 0) + literals.length);
      byProperty.set(declaration.property, (byProperty.get(declaration.property) ?? 0) + literals.length);
    }
  }
  return { total, bySelector, byProperty };
}

/** Khai báo `:root` mong đợi, sinh từ tokens.json: khối sáng phát mọi token, khối tối phát token có `dark`. */
export function expectedTokenBlocks(tokens) {
  const light = [];
  const dark = [];
  const lightOf = (token) => token.value ?? token.light;
  const push = (token) => {
    const value = lightOf(token);
    if (typeof value === 'string') light.push([token.var, value]);
    if (typeof token.dark === 'string') dark.push([token.var, token.dark]);
  };
  for (const [group, value] of Object.entries(tokens)) {
    if (group === 'meta' || group === 'components') continue;
    if (group === 'color') {
      // `color.light` chỉ vào khối sáng, `color.dark` chỉ vào khối tối, `unit`/`faction`/… có cả hai.
      for (const token of Object.values(value.light)) light.push([token.var, lightOf(token)]);
      for (const token of Object.values(value.dark)) dark.push([token.var, lightOf(token)]);
      for (const sub of ['unit', 'faction', 'status', 'tier', 'tint']) {
        for (const token of Object.values(value[sub] ?? {})) push(token);
      }
      continue;
    }
    if (group === 'type') {
      // Vai trò chữ: `font` shorthand (weight size/line-height family) + letter-spacing riêng nếu có.
      for (const [role, token] of Object.entries(value)) {
        light.push([`--type-${role}`, `${token.weight} ${token.size}/${token.lineHeight} ${tokens.font[token.family].value}`]);
        if (token.letterSpacing) light.push([`--type-${role}-spacing`, token.letterSpacing]);
      }
      continue;
    }
    for (const token of Object.values(value)) push(token);
  }
  return { light, dark };
}

export async function readTokens() {
  return JSON.parse(await readFile(TOKENS_PATH, 'utf8'));
}

const HEX_COLOR = /^#([0-9a-f]{6})$/i;

/** Tỉ lệ tương phản WCAG giữa hai mã hex 6 chữ số. */
export function contrastRatio(first, second) {
  const luminance = (hex) => {
    const [r, g, b] = [0, 2, 4].map((at) => {
      const channel = Number.parseInt(hex.slice(1 + at, 3 + at), 16) / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Ngưỡng tương phản khai ở `meta.contrast` (`{theme, fg, bg, min, role}`): mỗi cặp custom property được giải
 * theo theme (khối tối đè khối sáng, `var(--x)` được lần theo) rồi so với `min`. Cặp nào không giải ra mã hex
 * cũng là lỗi, để ngưỡng không lặng lẽ biến mất khi đổi tên token.
 */
export function contrastProblems(tokens) {
  const blocks = expectedTokenBlocks(tokens);
  const resolved = {
    light: new Map(blocks.light),
    dark: new Map([...blocks.light, ...blocks.dark]),
  };
  const colorOf = (theme, name) => {
    let value = resolved[theme].get(name);
    for (let hops = 0; typeof value === 'string' && value.startsWith('var(') && hops < 8; hops += 1) {
      value = resolved[theme].get(value.slice(4, -1).trim());
    }
    return HEX_COLOR.test(value ?? '') ? value : null;
  };
  const problems = [];
  for (const { theme, fg, bg, min, role } of tokens.meta?.contrast ?? []) {
    const [fgColor, bgColor] = [colorOf(theme, fg), colorOf(theme, bg)];
    if (!fgColor || !bgColor) {
      problems.push(`tương phản ${theme} ${fg} ↔ ${bg} (${role}): không giải được thành mã hex`);
      continue;
    }
    const ratio = contrastRatio(fgColor, bgColor);
    if (ratio < min) {
      problems.push(`tương phản ${theme} ${fg} ${fgColor} ↔ ${bg} ${bgColor} (${role}): ${ratio.toFixed(2)}:1 < ${min}:1`);
    }
  }
  return problems;
}

/** Mọi vấn đề của cây hiện tại; rỗng nghĩa là `--check` pass. */
export async function checkDesignTokens(options = {}) {
  const tokens = options.tokens ?? await readTokens();
  const css = options.css ?? await readFile(CSS_PATH, 'utf8');
  const problems = [];
  const { light, dark, legacyCeiling, legacy, fresh } = splitStylesheet(css);
  const expected = expectedTokenBlocks(tokens);
  const compare = (label, actual, wanted) => {
    const actualText = actual.map(([name, value]) => `${name}: ${value}`).join('; ');
    const wantedText = wanted.map(([name, value]) => `${name}: ${value}`).join('; ');
    if (actualText === wantedText) return;
    const missing = wanted.filter(([name]) => !actual.some(([other]) => other === name));
    const extra = actual.filter(([name]) => !wanted.some(([other]) => other === name));
    const drifted = wanted
      .filter(([name, value]) => actual.some(([other, actualValue]) => other === name && actualValue !== value))
      .map(([name, value]) => `${name} (mong đợi ${value}, đang ${actual.find(([other]) => other === name)?.[1]})`);
    problems.push(
      `${label} lệch tokens.json: thiếu [${missing.map(([name]) => name).join(', ')}]`
      + `; thừa [${extra.map(([name]) => name).join(', ')}]`
      + `; sai giá trị/thứ tự [${drifted.join(', ')}]`,
    );
  };
  compare(':root', light, expected.light);
  compare(':root[data-theme="dark"]', dark, expected.dark);
  problems.push(...contrastProblems(tokens));

  // `@font-face` là descriptor của chính file font (font-weight/unicode-range), không phải giá trị thiết kế.
  const scannable = (rules) => rules.filter(({ selector }) => !selector.startsWith('@'));
  for (const region of [fresh, legacy]) {
    const label = region === fresh ? 'CSS mới' : 'khối legacy';
    for (const { selector, declarations: list } of scannable(cssRules(region))) {
      for (const declaration of list) {
        for (const literal of colorLiterals(declaration.value)) {
          problems.push(`${label}: mã màu ${literal} ngoài khối token (${selector} { ${declaration.property} })`);
        }
      }
    }
  }
  for (const { selector, declarations: list } of scannable(cssRules(fresh))) {
    for (const declaration of list) {
      const literals = rawLiterals(declaration);
      if (literals.length) {
        problems.push(`CSS mới: giá trị thô ${literals.join(' ')} (${selector} { ${declaration.property} })`);
      }
    }
  }
  const legacyRaw = tallyRawValues(legacy);
  if (legacyRaw.total > legacyCeiling) {
    problems.push(`khối legacy: ${legacyRaw.total} giá trị thô vượt ceiling ${legacyCeiling}`);
  }
  return { problems, legacyRaw, expected };
}

/* ===== Trích giá trị artboard ===== */

/** Inline style + `<style>` của một artboard, đã bỏ biểu thức `{{ … }}` (giá trị động). */
export function artboardStyles(html) {
  const found = [];
  const collect = (text) => {
    for (const { property, value } of declarations(text)) {
      found.push({ property, value: value.includes('{{') ? '<dynamic>' : value });
    }
  };
  for (const [, attributes] of html.matchAll(/\bstyle="([^"]*)"/g)) collect(attributes);
  for (const [, block] of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    for (const { declarations: list } of cssRules(block)) {
      for (const { property, value } of list) {
        found.push({ property, value: value.includes('{{') ? '<dynamic>' : value });
      }
    }
  }
  return found;
}

/** Giá trị màu của `renderVals()` trong StyleGuide (nguồn duy nhất cho bảng màu sáng/tối/phe). */
export function renderVals(html) {
  const script = html.match(/renderVals\(\)\s*\{([\s\S]*?)\n  \}/);
  if (!script) throw new Error('StyleGuide.dc.html thiếu renderVals()');
  const group = (name) => {
    const body = script[1].match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]`));
    if (!body) throw new Error(`renderVals() thiếu ${name}`);
    return [...body[1].matchAll(/\{[^{}]*\}/g)].map(([row]) =>
      Object.fromEntries([...row.matchAll(/(\w+):\s*'([^']*)'/g)].map(([, key, value]) => [key, value])));
  };
  return { light: group('light'), dark: group('dark'), factions: group('factions') };
}

function frequencies(entries) {
  const counts = new Map();
  for (const { property, value } of entries) {
    if (!counts.has(property)) counts.set(property, new Map());
    const values = counts.get(property);
    values.set(value, (values.get(value) ?? 0) + 1);
  }
  return counts;
}

const REPORT_PROPERTIES = [
  'font-size', 'font-family', 'font-weight', 'line-height', 'letter-spacing', 'text-transform',
  'color', 'background', 'border', 'padding', 'margin', 'gap', 'row-gap', 'column-gap',
  'border-radius', 'min-height', 'height', 'width', 'box-shadow', 'z-index', 'grid-template-columns',
  'max-width', 'min-width', 'outline', 'transition', 'padding-top', 'padding-bottom', 'padding-left',
  'padding-right', 'padding-inline', 'padding-block', 'margin-top', 'margin-bottom', 'inset',
];

/** Bảng đầy đủ (không cắt dòng): báo cáo tần suất là bằng chứng nguồn của `tokens.json`. */
function markdownTable(counts, property) {
  const values = counts.get(property);
  if (!values) return [];
  const rows = [...values].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const lines = [`**${property}** — ${rows.length} giá trị`, '', '| Giá trị | Lần |', '| --- | --- |'];
  for (const [value, count] of rows) lines.push(`| \`${value}\` | ${count} |`);
  lines.push('');
  return lines;
}

/** Tổ hợp chữ theo từng phần tử (mỗi `style="…"` là một phần tử) — nguồn cho nhóm `type`. */
export function typeCombos(html) {
  const combos = new Map();
  for (const [, attributes] of html.matchAll(/\bstyle="([^"]*)"/g)) {
    if (attributes.includes('{{')) continue;
    const list = declarations(attributes);
    const pick = (property) => list.find((declaration) => declaration.property === property)?.value ?? '';
    const family = pick('font-family').replace(/['"]/g, '').split(',')[0].trim();
    const combo = [
      family || 'kế thừa',
      pick('font-size') || 'kế thừa',
      pick('font-weight') || 'kế thừa',
      pick('line-height') || 'kế thừa',
      pick('letter-spacing') || 'kế thừa',
    ].join(' · ');
    combos.set(combo, (combos.get(combo) ?? 0) + 1);
  }
  return combos;
}

/** Báo cáo markdown: tần suất artboard, giá trị thô của CSS theo selector, và mốc legacy. */
export async function extractionReport(cssOption) {
  const css = cssOption ?? await readFile(CSS_PATH, 'utf8');
  const boards = await pageArtboards();
  const entries = [];
  const combos = new Map();
  for (const board of boards) {
    const html = await readFile(join(PROJECT_DIR, board.file), 'utf8');
    const styles = artboardStyles(html);
    entries.push(...styles);
    for (const [combo, count] of typeCombos(html)) combos.set(combo, (combos.get(combo) ?? 0) + count);
  }
  const counts = frequencies(entries);
  const guideHtml = await readFile(join(PROJECT_DIR, `${STYLE_GUIDE}.dc.html`), 'utf8');
  const vals = renderVals(guideHtml);
  let legacy = '';
  let legacyCeiling = 0;
  let fresh = css;
  try {
    ({ legacy, legacyCeiling, fresh } = splitStylesheet(css));
  } catch {
    legacyCeiling = 0;
  }
  const legacyRaw = tallyRawValues(legacy);
  const freshRaw = tallyRawValues(fresh);

  const lines = [
    `# Tần suất giá trị artboard — ${boards.length} artboard trang`,
    '',
    `Nguồn: \`docs/design/so-binh-phap/project/*.dc.html\` (inline style + \`<style>\`), trích bằng`,
    '`node scripts/design-tokens.mjs --extract`. Bỏ 3 artboard hướng A/B/C và StyleGuide.',
    '`<dynamic>` là giá trị nội suy `{{ … }}` theo dữ liệu mẫu, không phải giá trị thiết kế.',
    '',
    `${entries.length} khai báo, ${[...counts].reduce((sum, [, values]) => sum + values.size, 0)} cặp thuộc tính/giá trị`,
    `trên ${counts.size} thuộc tính.`,
    '',
    '## Bảng màu `renderVals()` (StyleGuide)',
    '',
    '| Nhóm | Tên | Giá trị |',
    '| --- | --- | --- |',
    ...vals.light.map((c) => `| sáng | ${c.name} | \`${c.hex}\` |`),
    ...vals.dark.map((c) => `| tối | ${c.name} | \`${c.hex}\` |`),
    ...vals.factions.map((f) => `| phe ${f.name} | sáng ${f.light} · tối ${f.dark} | |`),
    '',
    '## Giá trị theo thuộc tính',
    '',
  ];
  for (const property of REPORT_PROPERTIES) lines.push(...markdownTable(counts, property));
  const other = [...counts.keys()].filter((property) => !REPORT_PROPERTIES.includes(property));
  if (other.length) lines.push(`Thuộc tính khác (không dùng làm token): ${other.sort().join(', ')}`, '');

  lines.push('## Tổ hợp chữ theo phần tử (nguồn cho nhóm `type`)', '');
  lines.push('| Font · size · weight · line-height · letter-spacing | Lần |', '| --- | --- |');
  for (const [combo, count] of [...combos].sort((a, b) => b[1] - a[1]).slice(0, 40)) {
    lines.push(`| \`${combo}\` | ${count} |`);
  }
  lines.push('');

  lines.push(
    '## Giá trị thô trong `css/styles.css`',
    '',
    `Ceiling khối legacy ghi trong comment: **${legacyCeiling}**.`,
    `Đang đo: **${legacyRaw.total}** giá trị thô trong khối legacy, **${freshRaw.total}** ngoài khối legacy.`,
    '',
    '| Thuộc tính | Số giá trị thô (legacy) |',
    '| --- | --- |',
    ...[...legacyRaw.byProperty].sort((a, b) => b[1] - a[1]).map(([property, count]) => `| \`${property}\` | ${count} |`),
    '',
    '| Selector | Số giá trị thô (legacy) |',
    '| --- | --- |',
    ...[...legacyRaw.bySelector].sort((a, b) => b[1] - a[1]).map(([selector, count]) => `| \`${selector}\` | ${count} |`),
    '',
  );
  return lines.join('\n');
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
const invoked = import.meta.url === invokedPath;
if (invoked) {
  const argv = process.argv.slice(2);
  if (argv.includes('--extract')) {
    const reportIndex = argv.indexOf('--report');
    const report = await extractionReport();
    if (reportIndex >= 0) {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(argv[reportIndex + 1], `${report}\n`);
      console.log(`Báo cáo tần suất → ${argv[reportIndex + 1]}`);
    } else {
      console.log(report);
    }
  } else if (argv.includes('--check')) {
    const { problems, legacyRaw } = await checkDesignTokens();
    if (problems.length) {
      for (const problem of problems) console.error(`FAIL ${problem}`);
      console.error(`${problems.length} vấn đề — khối token lệch tokens.json hoặc còn giá trị thô/mã màu ngoài khối legacy.`);
      process.exit(1);
    }
    const selectors = [...legacyRaw.bySelector].sort((a, b) => b[1] - a[1]);
    console.log(`ok   :root khớp tokens.json; đạt ngưỡng tương phản meta.contrast; 0 mã màu ngoài khối token; 0 giá trị thô ngoài khối legacy.`);
    console.log(`     mốc legacy: ${legacyRaw.total} giá trị thô trên ${selectors.length} selector (ceiling đã ghi trong file).`);
    for (const [selector, count] of selectors.slice(0, 20)) console.log(`     ${String(count).padStart(4)}  ${selector}`);
  } else {
    console.log('Dùng: node scripts/design-tokens.mjs --extract [--report <file>] | --check');
    process.exit(1);
  }
}
