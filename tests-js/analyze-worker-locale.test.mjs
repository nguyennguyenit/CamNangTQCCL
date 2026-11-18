import assert from 'node:assert/strict';
import test from 'node:test';
import { callWorker } from '../js/analyze.js';
import { SITE_LOCALES } from '../js/i18n.js';

// callWorker gửi `locale` theo ngôn ngữ trang để Worker chọn prompt đọc ảnh.
// Ca ja chỉ chạy khi `ja` đã nằm trong SITE_LOCALES (nếu chưa, normalizeLocale trả vi).
const cases = [['vi', 'vi'], ['zh-CN', 'zh'], ['ja', 'ja']].filter(([, expected]) => SITE_LOCALES.includes(expected));
for (const [lang, expected] of cases) {
  test(`callWorker gửi locale ${expected} cho trang lang=${lang}`, async t => {
    const originalFetch = globalThis.fetch;
    const originalDocument = globalThis.document;
    t.after(() => { globalThis.fetch = originalFetch; globalThis.document = originalDocument; });
    globalThis.document = { documentElement: { lang } };
    let sent = null;
    globalThis.fetch = async (_url, init) => {
      sent = JSON.parse(init.body);
      return { ok: true, status: 200, async json() { return { tactics: ['x'] }; } };
    };
    await callWorker('data:image/png;base64,AA==', 'token', 'scanTactics');
    assert.equal(sent.locale, expected);
    assert.equal(sent.mode, 'scanTactics');
  });
}
