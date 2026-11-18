import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as i18n from '../js/i18n.js';

// Danh sách locale của Worker (`worker/src/locales.ts`) phải trùng danh sách locale của site, nếu không
// một locale site gửi lên sẽ bị Worker từ chối (hoặc ngược lại Worker nhận locale site không có).
const siteLocales = i18n.SITE_LOCALES ?? i18n.LOCALES;

function workerLocales() {
  const source = readFileSync(new URL('../worker/src/locales.ts', import.meta.url), 'utf8');
  const match = source.match(/export const WORKER_LOCALES = \[([^\]]*)\] as const;/);
  assert.ok(match, 'không tìm thấy WORKER_LOCALES trong worker/src/locales.ts');
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

test('Worker và site cùng một danh sách locale', () => {
  assert.ok(Array.isArray(siteLocales) || Object.isFrozen(siteLocales), 'js/i18n.js phải xuất danh sách locale');
  assert.deepEqual([...workerLocales()].sort(), [...siteLocales].sort());
});
