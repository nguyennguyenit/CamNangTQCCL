// N8-1: trạng thái "đang chọn" và nút chính phải đọc được trên nền trang ở CẢ HAI theme.
// Theme tối trước đây mượn `--band` (màu dải header #0F0E0B) nên nền chip chỉ 1,05:1 với nền trang
// #16140F và 1,28:1 với chip chưa chọn #2A2620 — chip trông như một cái lỗ. Họ token `--select*` thay thế.
// Đo trên DOM thật: nền đối chiếu là tổ tiên gần nhất có nền đục, và nền của một phần tử anh em chưa chọn.
import { expect, test } from '@playwright/test';

const MIN_NON_TEXT = 3;   // WCAG 1.4.11 (thành phần/trạng thái)
const MIN_TEXT = 4.5;     // WCAG 1.4.3

const toRgb = (value) => {
  const numbers = String(value).match(/[\d.]+/g);
  return numbers ? numbers.slice(0, 3).map(Number) : null;
};

const luminance = (rgb) => {
  const [r, g, b] = rgb.map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (from, to) => {
  const a = toRgb(from);
  const b = toRgb(to);
  expect(a, `màu không đọc được: ${from}`).toBeTruthy();
  expect(b, `màu không đọc được: ${to}`).toBeTruthy();
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/** Mỗi ca: trang, selector đang chọn, selector chưa chọn cùng loại (nền so sánh), các selector con lấy màu chữ. */
const CASES = [
  { path: '/cung-ton/', selected: '.coexist-scenario[aria-pressed="true"]', unselected: '.coexist-scenario[aria-pressed="false"]', kids: [] },
  { path: '/cung-ton/', selected: '.coexist-group-chip[aria-pressed="true"]', unselected: '.coexist-group-chip[aria-pressed="false"]', kids: ['.coexist-chip-note'] },
  { path: '/doi-chuan/', selected: '.view-btn[aria-pressed="true"]', unselected: '.view-btn[aria-pressed="false"]', kids: [] },
  { path: '/khai-hoang/', selected: '.kh-config-chip[aria-pressed="true"]', unselected: '.kh-config-chip[aria-pressed="false"]', kids: [] },
  // Tab Tra cứu ở desktop giữ hợp đồng cũ: chữ mực trên nền giấy + gạch chân son, KHÔNG dùng nền chọn
  // (tương phản chữ của nó đã có test riêng trong unified-lookup.spec.mjs). Chỉ viên mobile dùng `--select`.
  { path: '/tra-cuu/?group=heroes', selected: '.lookup-chip[aria-pressed="true"]', unselected: '.lookup-chip[aria-pressed="false"]', kids: ['.lookup-chip-count'], widths: [390] },
  { path: '/goi-y-doi/', selected: '.roster-step[data-state="current"]', unselected: '.roster-step[data-state="pending"]', kids: [] },
  { path: '/soi-doi/', selected: '.ana-btn.primary', unselected: '.ana-btn:not(.primary):not(:disabled)', kids: [] },
];

/** Bảng lọc phe chỉ có ở /doi-chuan/ và chỉ đúng sau khi người dùng bật một chip: giữ riêng vì cần click. */
const FACTION = { path: '/doi-chuan/', chip: '#section-team-chuan .reference-filters .fchip.f-thuc' };

const measure = (page, { selected, unselected, kids }) => page.evaluate(({ selected, unselected, kids }) => {
  const alpha = (value) => {
    const numbers = String(value).match(/[\d.]+/g);
    return numbers && numbers.length > 3 ? Number(numbers[3]) : 1;
  };
  const opaqueAncestor = (node) => {
    for (let el = node.parentElement; el; el = el.parentElement) {
      const bg = getComputedStyle(el).backgroundColor;
      if (bg && bg !== 'transparent' && alpha(bg) > 0.98) return bg;
    }
    return getComputedStyle(document.documentElement).backgroundColor;
  };
  const node = document.querySelector(selected);
  if (!node) return { missing: selected };
  const style = getComputedStyle(node);
  const sibling = document.querySelector(unselected);
  return {
    bg: style.backgroundColor,
    ink: style.color,
    ancestor: opaqueAncestor(node),
    sibling: sibling ? getComputedStyle(sibling).backgroundColor : null,
    kids: kids.map((kidSelector) => {
      const kid = node.querySelector(kidSelector);
      return kid ? { kidSelector, color: getComputedStyle(kid).color } : null;
    }).filter(Boolean),
  };
}, { selected, unselected, kids });

for (const theme of ['dark', 'light']) {
  for (const width of [1440, 390]) {
    test(`trạng thái đang chọn đủ tương phản nền và chữ (${theme}, ${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((value) => { try { localStorage.setItem('theme', value); } catch { /* storage bị chặn */ } }, theme);
      for (const item of CASES) {
        if (item.widths && !item.widths.includes(width)) continue;
        await page.goto(item.path);
        await expect(page.locator(item.selected).first(), `${item.path} ${item.selected}`).toBeVisible();
        const measured = await measure(page, item);
        const label = `${theme}/${width} ${item.path} ${item.selected}`;
        expect(measured.missing, label).toBeUndefined();
        expect(measured.bg, `${label}: nền không được trong suốt`).not.toBe('rgba(0, 0, 0, 0)');
        // 1.4.11: nền trạng thái đang chọn tách khỏi nền trang và khỏi nền chip chưa chọn cùng loại.
        expect(contrast(measured.bg, measured.ancestor), `${label}: nền so với nền đục gần nhất`).toBeGreaterThanOrEqual(MIN_NON_TEXT);
        if (measured.sibling) {
          expect(contrast(measured.bg, measured.sibling), `${label}: nền so với chip chưa chọn`).toBeGreaterThanOrEqual(MIN_NON_TEXT);
        }
        // 1.4.3: chữ trên nền trạng thái, kể cả chữ phụ tự đổi màu theo trạng thái.
        expect(contrast(measured.ink, measured.bg), `${label}: chữ trên nền`).toBeGreaterThanOrEqual(MIN_TEXT);
        for (const kid of measured.kids) {
          expect(contrast(kid.color, measured.bg), `${label}: ${kid.kidSelector}`).toBeGreaterThanOrEqual(MIN_TEXT);
        }
      }
    });
  }
}

test('chip phe đang bật: ô vuông phe và số đếm đọc được ở cả hai theme', async ({ page }) => {
  for (const theme of ['dark', 'light']) {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((value) => { try { localStorage.setItem('theme', value); } catch { /* storage bị chặn */ } }, theme);
      await page.goto(FACTION.path);
      if (width === 390) await page.locator('#section-team-chuan .filter-collapse-toggle').click();
      const chip = page.locator(FACTION.chip);
      await expect(chip).toBeVisible();
      await chip.click();
      // Node bị dựng lại sau mỗi lần lọc nên phải đọc lại phần tử đang bật, không giữ tham chiếu cũ.
      const measured = await page.evaluate((target) => {
        const live = document.querySelector(`${target}[aria-pressed="true"]`);
        if (!live) return null;
        const dot = getComputedStyle(live, '::before');
        const count = live.querySelector('.fchip-count');
        const check = live.querySelector('.fchip-check');
        return {
          chipBg: getComputedStyle(live).backgroundColor,
          ink: getComputedStyle(live).color,
          dot: dot.backgroundColor,
          dotWidth: Number.parseFloat(dot.width),
          count: count ? getComputedStyle(count).color : null,
          checkBg: check ? getComputedStyle(check).backgroundColor : null,
          checkInk: check ? getComputedStyle(check, '::after').color : null,
        };
      }, FACTION.chip);
      const label = `${theme}/${width} chip phe`;
      expect(measured, label).toBeTruthy();
      expect(measured.dotWidth, `${label}: ô vuông phe được vẽ`).toBe(8);
      expect(contrast(measured.ink, measured.chipBg), `${label}: chữ trên nền`).toBeGreaterThanOrEqual(MIN_TEXT);
      if (measured.count) expect(contrast(measured.count, measured.chipBg), `${label}: số đếm`).toBeGreaterThanOrEqual(MIN_TEXT);
      if (measured.checkInk && measured.checkBg) {
        expect(contrast(measured.checkInk, measured.checkBg), `${label}: dấu ✓`).toBeGreaterThanOrEqual(MIN_TEXT);
      }
      // Ô vuông phe là trang trí (nhãn đã nêu tên phe) nhưng vẫn phải thấy được: mục tiêu thiết kế ≥3:1.
      expect(contrast(measured.dot, measured.chipBg), `${label}: ô vuông phe`).toBeGreaterThanOrEqual(MIN_NON_TEXT);
    }
  }
});
