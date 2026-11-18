// Cây route của mọi locale có tiền tố là bản gương của `src/pages/zh/`: cùng tập file, nội dung chỉ khác mã locale
// (thay route động `[locale]` để tránh xung đột ưu tiên route của Astro, test giữ các bản gương không lệch nhau).
//
// Locale đã khai bảng ở `js/i18n.js` nhưng chưa nối vào `SITE_LOCALES` để route ở `src/pages/_<mã>/`: Astro bỏ qua thư
// mục bắt đầu bằng `_` nên trang chưa được sinh, và `tsconfig.json` loại thư mục đó khỏi `astro check` (prop
// `locale="<mã>"` chưa thuộc kiểu `SiteLocale`). Bật locale = nối mã vào `SITE_LOCALES`, đổi tên thư mục thành
// `src/pages/<mã>/` và bỏ dòng loại trừ trong `tsconfig.json`; test này đỏ cho tới khi làm đủ.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { DEFAULT_LOCALE, LOCALE_PREFIX, SITE_LOCALES } from "../js/i18n.js";

const PAGES = fileURLToPath(new URL("../src/pages/", import.meta.url));
const TSCONFIG = fileURLToPath(new URL("../tsconfig.json", import.meta.url));
const MODEL_LOCALE = "zh";
/** Tên tiếng Việt của ngôn ngữ trong chú thích vỏ route ("bản Trung", "bài tiếng Trung"). */
const LANGUAGE_NAME_VI = Object.freeze({ zh: "Trung", ja: "Nhật" });

const knownLocales = Object.keys(LOCALE_PREFIX).filter((locale) => locale !== DEFAULT_LOCALE);
const filesUnder = (dir) => readdirSync(dir, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => join(entry.parentPath ?? entry.path, entry.name).slice(dir.length + 1))
  .sort();
const routeDir = (locale) => join(PAGES, SITE_LOCALES.includes(locale) ? locale : `_${locale}`);

/** Nội dung bản gương mong đợi: mã locale trong dấu nháy và tên ngôn ngữ trong chú thích đổi theo locale. */
function mirrorOf(source, locale) {
  assert.ok(LANGUAGE_NAME_VI[locale], `thiếu tên tiếng Việt của locale ${locale}`);
  return source
    .replace(/(['"`])zh\1/g, `$1${locale}$1`)
    .replace(/\bTrung\b/g, LANGUAGE_NAME_VI[locale]);
}

test("mỗi locale có tiền tố nằm đúng một thư mục route: bật ở src/pages/<mã>/, chưa bật ở src/pages/_<mã>/", () => {
  assert.ok(knownLocales.includes(MODEL_LOCALE));
  for (const locale of knownLocales) {
    const enabled = SITE_LOCALES.includes(locale);
    assert.equal(existsSync(join(PAGES, locale)), enabled, `src/pages/${locale}/ ${enabled ? "phải có" : "chưa được có (Astro sẽ sinh trang)"}`);
    assert.equal(existsSync(join(PAGES, `_${locale}`)), !enabled, `src/pages/_${locale}/ ${enabled ? "phải đổi tên thành src/pages/" + locale + "/" : "phải có"}`);
  }
});

test("tsconfig chỉ loại khỏi astro check thư mục route của locale chưa bật", () => {
  const exclude = JSON.parse(readFileSync(TSCONFIG, "utf8")).exclude ?? [];
  for (const locale of knownLocales) {
    const staged = `src/pages/_${locale}`;
    assert.equal(exclude.includes(staged), !SITE_LOCALES.includes(locale), `tsconfig exclude ${staged}`);
  }
});

test("route của mọi locale có tiền tố là bản gương của src/pages/zh/", () => {
  const model = filesUnder(join(PAGES, MODEL_LOCALE));
  assert.ok(model.length >= 20, `src/pages/zh/ chỉ có ${model.length} file`);
  for (const locale of knownLocales.filter((locale) => locale !== MODEL_LOCALE)) {
    const dir = routeDir(locale);
    assert.deepEqual(filesUnder(dir), model, `${dir} khác tập file của src/pages/zh/`);
    for (const file of model) {
      const expected = mirrorOf(readFileSync(join(PAGES, MODEL_LOCALE, file), "utf8"), locale);
      assert.equal(readFileSync(join(dir, file), "utf8"), expected, `${locale}: ${file} lệch bản gương`);
    }
  }
});

test("vỏ route bản gương truyền đúng mã locale cho component", () => {
  for (const locale of knownLocales) {
    const dir = routeDir(locale);
    const shells = filesUnder(dir).filter((file) => file.endsWith(".astro") && !file.startsWith("bai-viet/["));
    for (const file of shells) {
      const text = readFileSync(join(dir, file), "utf8");
      assert.match(text, new RegExp(`locale="${locale}"`), `${locale}: ${file} không truyền locale="${locale}"`);
      assert.doesNotMatch(text, new RegExp(`locale="(?!${locale}")`), `${locale}: ${file} truyền locale khác`);
    }
  }
});
